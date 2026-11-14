"use server";

import { revalidatePath } from "next/cache";
import { resolveBoard } from "@/lib/connectors/ats";
import { discoverCompanies } from "@/lib/discovery";
import { fetchPublicHtml } from "@/lib/net";
import { ensureCompanyCard } from "@/lib/pipeline";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

async function ctx() {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("not signed in");
  return { db, user };
}

export type CompanyFormState = { ok?: string; error?: string } | null;

const TIER_HE = { A: "A — יציבה מאוד", B: "B — יציבה", C: "C — בסיכון" } as const;

/** Research (or re-research) a company's rating card. Cards are a shared cache → service role. */
async function rate(name: string, force = false) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return ensureCompanyCard(supabaseAdmin(), name, force);
}

/** Add a company by name: find its public job board and build its rating card. */
export async function addCompany(_prev: CompanyFormState, form: FormData): Promise<CompanyFormState> {
  const { db, user } = await ctx();
  const name = String(form.get("name") ?? "").trim();
  const careersUrl = String(form.get("careers_url") ?? "").trim() || null;
  if (!name) return { error: "צריך שם חברה" };

  const [board, card] = await Promise.all([
    resolveBoard({ name, careersUrl, fetchHtml: (u) => fetchPublicHtml(u, 12_000) }).catch(() => null),
    rate(name).catch(() => null),
  ]);
  const { error } = await db.from("companies").upsert(
    {
      user_id: user.id,
      name,
      ats: board?.ats ?? "none",
      ats_board: board?.board ?? null,
      ats_token: board?.token ?? null,
      status: "active",
    },
    { onConflict: "user_id,name" },
  );
  if (error) return { error: error.message };
  revalidatePath("/companies");

  const rating = card ? ` דירוג: ${TIER_HE[card.tier]}.` : "";
  return board
    ? { ok: `נמצא לוח משרות (${board.ats}). החברה תיסרק מעכשיו.${rating}` }
    : {
        ok: `החברה נוספה, אבל לא נמצא לה לוח משרות שאפשר לסרוק. משרות שלה ייקלטו דרך LinkedIn או בהוספה ידנית. אפשר לנסות שוב עם כתובת עמוד הקריירה.${rating}`,
      };
}

/** AI: suggest ~20 fitting companies; they appear under "הצעות" for approval. */
export async function suggestMore(): Promise<CompanyFormState> {
  const { db, user } = await ctx();
  if (!process.env.ANTHROPIC_API_KEY) return { error: "חסר מפתח AI" };
  try {
    const r = await discoverCompanies(db, user.id, 20);
    revalidatePath("/companies");
    if (!r.added) return { ok: "לא נמצאו הצעות חדשות הפעם." };
    return { ok: `נוספו ${r.added} הצעות. ל-${r.scannable} מהן נמצא לוח משרות שאפשר לסרוק.` };
  } catch (e) {
    return { error: `החיפוש נכשל: ${(e as Error).message.slice(0, 200)}` };
  }
}

/** Approve a suggestion: start scanning it and build its rating card. */
export async function approveSuggestion(id: string) {
  const { db } = await ctx();
  const { data: c } = await db.from("companies").update({ status: "active" }).eq("id", id).select("name").single();
  if (c) await rate(c.name).catch(() => null);
  revalidatePath("/companies");
}

export async function rejectSuggestion(id: string) {
  const { db } = await ctx();
  await db.from("companies").update({ status: "rejected" }).eq("id", id);
  revalidatePath("/companies");
}

/** Build or refresh a company's rating card with web research. */
export async function rateCompany(name: string) {
  await ctx();
  await rate(name, true).catch(() => null);
  revalidatePath("/companies");
}

export async function setCompanyStatus(id: string, status: "active" | "blacklist" | "paused") {
  const { db } = await ctx();
  await db.from("companies").update({ status }).eq("id", id);
  revalidatePath("/companies");
}

export async function setTierOverride(id: string, tier: "A" | "B" | "C" | null) {
  const { db } = await ctx();
  await db.from("companies").update({ tier_override: tier }).eq("id", id);
  revalidatePath("/companies");
}
