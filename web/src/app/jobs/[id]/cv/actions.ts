"use server";

import { revalidatePath } from "next/cache";
import { EMPTY_CONTACT, generateTailoredCv, type CvDoc, type TailoredDoc } from "@/lib/cv";
import type { ProfileItem } from "@/lib/profile-seed";
import { supabaseServer } from "@/lib/supabase/server";

export type TailorState = { ok?: string; error?: string } | null;

/** Build a CV + cover letter tailored to this job and save it as a new version. */
export async function tailorCv(jobId: string, lang: "he" | "en"): Promise<TailorState> {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "צריך להתחבר מחדש" };
  if (!process.env.ANTHROPIC_API_KEY) return { error: "חסר מפתח AI" };

  const [{ data: job }, { data: items }, { data: base }] = await Promise.all([
    db.from("jobs").select("title,company,description").eq("id", jobId).maybeSingle(),
    db.from("master_profile_items").select("*").order("start_date", { ascending: false, nullsFirst: true }),
    db.from("cv_base").select("content").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!job) return { error: "המשרה לא נמצאה" };
  if (!items?.length) return { error: "הפרופיל ריק" };

  try {
    const t = await generateTailoredCv(items as ProfileItem[], job, lang);
    const savedContact = (base?.content as Partial<CvDoc> | undefined)?.contact;
    const content: TailoredDoc = {
      ...t.cv,
      contact: { ...EMPTY_CONTACT, name: user.user_metadata?.full_name ?? "", email: user.email ?? "", ...(savedContact ?? {}), headline: "" },
      generated_at: new Date().toISOString(),
      changes_he: t.changes_he,
      gaps_he: t.gaps_he,
    };
    const { error } = await db
      .from("cv_versions")
      .insert({ user_id: user.id, job_id: jobId, lang, content, cover_letter: t.cover_letter });
    if (error) return { error: error.message };
    revalidatePath(`/jobs/${jobId}/cv`);
    return { ok: "נוצרו קורות חיים מותאמים" };
  } catch (e) {
    return { error: (e as Error).message.slice(0, 200) };
  }
}
