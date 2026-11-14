"use server";

import { revalidatePath } from "next/cache";
import { combine, type Breakdown } from "@/lib/scoring/score";
import { supabaseServer } from "@/lib/supabase/server";
import { DEFAULT_WEIGHTS, type Weights } from "@/lib/types";

export type SettingsState = { ok?: string; error?: string } | null;

const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

export async function saveSettings(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "צריך להתחבר מחדש" };

  const weights = Object.fromEntries(
    (Object.keys(DEFAULT_WEIGHTS) as (keyof Weights)[]).map((k) => [k, Math.max(0, Math.min(100, Number(form.get(`w_${k}`) ?? 0)))]),
  ) as unknown as Weights;

  const { error } = await db
    .from("preferences")
    .update({
      home_address: String(form.get("home_address") ?? "").trim() || "קריית אונו",
      max_commute_min: Number(form.get("max_commute_min") ?? 45),
      target_salary: Number(form.get("target_salary") ?? 23000),
      role_tracks: form.getAll("role_tracks").map(String),
      weights,
      preferred_domains: list(form.get("preferred_domains")),
      negative_keywords: list(form.get("negative_keywords")),
      preference_notes: String(form.get("preference_notes") ?? ""),
      max_job_age_days: Math.max(1, Math.min(365, Number(form.get("max_job_age_days") ?? 30) || 30)),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  // Re-rank every scored job with the new weights — no AI call needed.
  const { data: scores } = await db.from("job_scores").select("job_id,breakdown");
  for (const s of scores ?? []) {
    await db.from("job_scores").update({ total: combine(s.breakdown as Breakdown, weights) }).eq("job_id", s.job_id);
  }

  revalidatePath("/", "layout");
  return { ok: `נשמר. ${scores?.length ?? 0} משרות דורגו מחדש.` };
}
