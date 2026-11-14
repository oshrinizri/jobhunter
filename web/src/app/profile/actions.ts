"use server";

import { revalidatePath } from "next/cache";
import { answersToOps, generateQuestions } from "@/lib/cv";
import { PROFILE_KINDS, type ProfileItem, type ProfileKind } from "@/lib/profile-seed";
import { supabaseServer } from "@/lib/supabase/server";
import { ageCutoffIso, DEFAULT_MAX_JOB_AGE_DAYS } from "@/lib/types";

async function ctx() {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("not signed in");
  return { db, user };
}

export type ActionState = { ok?: string; error?: string; lines?: string[] } | null;

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const dateOrNull = (v: FormDataEntryValue | null) => {
  const s = str(v);
  if (!s) return null;
  return /^\d{4}-\d{2}$/.test(s) ? `${s}-01` : /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

async function loadItems(db: Awaited<ReturnType<typeof supabaseServer>>) {
  const { data } = await db.from("master_profile_items").select("*").order("sort_order");
  return (data ?? []) as (ProfileItem & { id: string })[];
}

/** Create or update one profile item from the edit form. */
export async function saveItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { db, user } = await ctx();
  const id = str(form.get("id"));
  const kind = str(form.get("kind")) as ProfileKind;
  if (!PROFILE_KINDS.includes(kind)) return { error: "סוג לא תקין" };
  const title = str(form.get("title"));
  if (!title) return { error: "צריך כותרת" };

  const row = {
    kind,
    title,
    org: str(form.get("org")) || null,
    start_date: dateOrNull(form.get("start_date")),
    end_date: dateOrNull(form.get("end_date")),
    details: str(form.get("details")),
    tags: str(form.get("tags"))
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };

  const { error } = id
    ? await db.from("master_profile_items").update(row).eq("id", id)
    : await db.from("master_profile_items").insert({ ...row, user_id: user.id, sort_order: Date.now() % 1_000_000_000 });
  if (error) return { error: error.message };
  revalidatePath("/profile");
  return { ok: "נשמר" };
}

export async function deleteItem(id: string) {
  const { db } = await ctx();
  await db.from("master_profile_items").delete().eq("id", id);
  revalidatePath("/profile");
}

/** Enrichment interview: AI asks a few targeted questions. */
export async function askQuestions(): Promise<ActionState> {
  const { db, user } = await ctx();
  if (!process.env.ANTHROPIC_API_KEY) return { error: "חסר מפתח AI" };
  const [items, { data: prefs }, { data: prev }] = await Promise.all([
    loadItems(db),
    db.from("preferences").select("role_tracks").maybeSingle(),
    db.from("profile_questions").select("question"),
  ]);
  try {
    const qs = await generateQuestions(items, prefs?.role_tracks ?? [], (prev ?? []).map((p) => p.question));
    if (!qs.length) return { ok: "אין כרגע שאלות חדשות" };
    const { error } = await db
      .from("profile_questions")
      .insert(qs.map((q) => ({ user_id: user.id, question: q.question, why: q.why })));
    if (error) return { error: error.message };
    revalidatePath("/profile");
    return { ok: `${qs.length} שאלות חדשות` };
  } catch (e) {
    return { error: (e as Error).message.slice(0, 200) };
  }
}

export async function skipQuestion(id: string) {
  const { db } = await ctx();
  await db.from("profile_questions").update({ status: "skipped" }).eq("id", id);
  revalidatePath("/profile");
}

/** Save the typed answers, then let the AI turn them into profile updates. */
export async function submitAnswers(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { db, user } = await ctx();
  const { data: open } = await db.from("profile_questions").select("id,question").eq("status", "open");
  const qa = (open ?? [])
    .map((q) => ({ id: q.id as string, question: q.question as string, answer: str(form.get(`a_${q.id}`)) }))
    .filter((x) => x.answer);
  if (!qa.length) return { error: "לא נכתבו תשובות" };

  for (const x of qa) await db.from("profile_questions").update({ answer: x.answer, status: "answered" }).eq("id", x.id);

  const items = await loadItems(db);
  try {
    const result = await answersToOps(items, qa);
    let changed = 0;
    for (const op of result.operations) {
      if (op.op === "update" && op.item_number) {
        const target = items[op.item_number - 1];
        if (!target) continue;
        const patch: Record<string, unknown> = {};
        if (op.details) patch.details = op.details;
        if (op.title) patch.title = op.title;
        if (op.tags?.length) patch.tags = [...new Set([...(target.tags ?? []), ...op.tags])];
        if (Object.keys(patch).length) {
          await db.from("master_profile_items").update(patch).eq("id", target.id);
          changed++;
        }
      } else if (op.op === "add" && op.kind && op.title) {
        await db.from("master_profile_items").insert({
          user_id: user.id,
          kind: op.kind,
          title: op.title,
          org: op.org,
          start_date: op.start_date,
          end_date: op.end_date,
          details: op.details ?? "",
          tags: op.tags ?? [],
          sort_order: Date.now() % 1_000_000_000,
        });
        changed++;
      }
    }
    for (const x of qa) await db.from("profile_questions").update({ status: "applied" }).eq("id", x.id);
    revalidatePath("/profile");
    return { ok: changed ? `הפרופיל עודכן (${changed} שינויים)` : "לא היה מה לעדכן מהתשובות", lines: result.summary_he };
  } catch (e) {
    return { error: `התשובות נשמרו, אבל העדכון נכשל: ${(e as Error).message.slice(0, 150)}` };
  }
}

/** After a profile change: clear scores of current jobs so the next scan re-scores them. */
export async function rescoreJobs(): Promise<ActionState> {
  const { db } = await ctx();
  const { data: prefs } = await db.from("preferences").select("max_job_age_days").maybeSingle();
  const cutoff = ageCutoffIso(prefs?.max_job_age_days ?? DEFAULT_MAX_JOB_AGE_DAYS);
  const { data: jobs } = await db
    .from("jobs")
    .select("id")
    .eq("is_open", true)
    .is("filtered_out", null)
    .or(`posted_at.is.null,posted_at.gte.${cutoff}`);
  const ids = (jobs ?? []).map((j) => j.id);
  if (ids.length) await db.from("job_scores").delete().in("job_id", ids);
  revalidatePath("/", "layout");
  return { ok: `${ids.length} משרות ידורגו מחדש בסריקה הבאה (07:00 / 17:00)` };
}
