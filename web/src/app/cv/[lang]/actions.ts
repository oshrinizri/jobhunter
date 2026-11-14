"use server";

import { revalidatePath } from "next/cache";
import { EMPTY_CONTACT, generateBaseCv, type CvContact, type CvDoc } from "@/lib/cv";
import type { ProfileItem } from "@/lib/profile-seed";
import { supabaseServer } from "@/lib/supabase/server";

export type CvState = { ok?: string; error?: string } | null;

async function ctx() {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("not signed in");
  return { db, user };
}

/** Contact details: the saved ones (either language), else name + email from the Google account. */
async function currentContact(db: Awaited<ReturnType<typeof supabaseServer>>, fallback: Partial<CvContact>): Promise<CvContact> {
  const { data } = await db.from("cv_base").select("content").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const saved = (data?.content as Partial<CvDoc> | undefined)?.contact;
  return { ...EMPTY_CONTACT, ...fallback, ...(saved ?? {}) };
}

export async function generateCv(lang: "he" | "en"): Promise<CvState> {
  const { db, user } = await ctx();
  if (!process.env.ANTHROPIC_API_KEY) return { error: "חסר מפתח AI" };
  const [{ data: items }, { data: prefs }] = await Promise.all([
    db.from("master_profile_items").select("*").order("start_date", { ascending: false, nullsFirst: true }),
    db.from("preferences").select("role_tracks").maybeSingle(),
  ]);
  if (!items?.length) return { error: "הפרופיל ריק" };
  try {
    const body = await generateBaseCv(items as ProfileItem[], lang, prefs?.role_tracks ?? []);
    const contact = await currentContact(db, { name: user.user_metadata?.full_name ?? "", email: user.email ?? "" });
    const content: CvDoc = { ...body, contact, generated_at: new Date().toISOString() };
    const { error } = await db
      .from("cv_base")
      .upsert({ user_id: user.id, lang, content, updated_at: new Date().toISOString() }, { onConflict: "user_id,lang" });
    if (error) return { error: error.message };
    revalidatePath(`/cv/${lang}`);
    return { ok: "קורות החיים נוצרו מהפרופיל" };
  } catch (e) {
    return { error: (e as Error).message.slice(0, 200) };
  }
}

/** Save contact details into both language versions. */
export async function saveContact(_prev: CvState, form: FormData): Promise<CvState> {
  const { db } = await ctx();
  const contact: CvContact = {
    name: String(form.get("name") ?? "").trim(),
    headline: String(form.get("headline") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
    email: String(form.get("email") ?? "").trim(),
    city: String(form.get("city") ?? "").trim(),
    linkedin: String(form.get("linkedin") ?? "").trim(),
  };
  const { data: rows } = await db.from("cv_base").select("user_id,lang,content");
  for (const r of rows ?? []) {
    await db
      .from("cv_base")
      .update({ content: { ...(r.content as object), contact }, updated_at: new Date().toISOString() })
      .eq("user_id", r.user_id)
      .eq("lang", r.lang);
  }
  revalidatePath("/cv/he");
  revalidatePath("/cv/en");
  return { ok: "פרטי הקשר נשמרו" };
}
