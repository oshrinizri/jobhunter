import { rawJobFromInput } from "./manual-add";
import { loadUserContext, processJob, upsertJob } from "./pipeline";
import { supabaseAdmin } from "./supabase/admin";

/** Shared by the Add screen and the iOS Shortcut endpoint. */
export async function addJobForUser(userId: string, url: string | null, text: string | null) {
  const raw = await rawJobFromInput(url, text);
  const db = supabaseAdmin();
  const ctx = await loadUserContext(db, userId);
  const { id } = await upsertJob(db, userId, raw);
  const result = await processJob(db, ctx, id, raw, { manual: true });
  return { id, title: raw.title, company: raw.company, result };
}
