// Job pipeline: store → dedup → hard filters → company card → commute → AI score (SPEC §5).
// Used by the scheduled ingest script and by the manual "add job" endpoint.

import type { SupabaseClient } from "@supabase/supabase-js";
import { PROFILE_SEED, profileToText, type ProfileItem } from "./profile-seed";
import { researchCompany, stabilityScore } from "./scoring/company-card";
import { bestCommute, commuteScore, computeCommute, destinationFor } from "./scoring/commute";
import { hardFilter } from "./scoring/filters";
import { assessJob, buildBreakdown, combine, tagsFor } from "./scoring/score";
import { jobFingerprint, normalizeCompanyName, detectLanguage } from "./text";
import {
  DEFAULT_MAX_JOB_AGE_DAYS,
  DEFAULT_WEIGHTS,
  isTooOld,
  type CompanyCard,
  type Commute,
  type Preferences,
  type RawJob,
} from "./types";
import { MODEL_SCORING } from "./ai";

/** Always excluded, regardless of the companies table (SPEC §12–13). */
export const FIXED_BLACKLIST = ["bank hapoalim", "בנק הפועלים", "hapoalim", "g-stat", "gstat", "ג'י-סטאט", "גי סטאט"];

export interface UserContext {
  userId: string;
  prefs: Preferences;
  profileText: string;
  blacklist: string[];
  tierOverrides: Map<string, "A" | "B" | "C">;
}

export async function loadUserContext(db: SupabaseClient, userId: string): Promise<UserContext> {
  const [{ data: prefRow, error: prefErr }, { data: items }, { data: companies }] = await Promise.all([
    db.from("preferences").select("*").eq("user_id", userId).single(),
    db.from("master_profile_items").select("*").eq("user_id", userId).order("sort_order"),
    db.from("companies").select("name,status,tier_override").eq("user_id", userId),
  ]);
  if (prefErr || !prefRow) throw new Error(`no preferences for user ${userId}: ${prefErr?.message}`);

  const prefs: Preferences = {
    ...prefRow,
    weights: { ...DEFAULT_WEIGHTS, ...prefRow.weights },
    max_job_age_days: prefRow.max_job_age_days ?? DEFAULT_MAX_JOB_AGE_DAYS,
  };
  const profile = (items?.length ? items : PROFILE_SEED) as ProfileItem[];
  const blacklist = [
    ...FIXED_BLACKLIST,
    ...(companies ?? []).filter((c) => c.status === "blacklist").map((c) => c.name as string),
  ];
  const tierOverrides = new Map<string, "A" | "B" | "C">();
  for (const c of companies ?? []) if (c.tier_override) tierOverrides.set(normalizeCompanyName(c.name), c.tier_override);

  return { userId, prefs, profileText: profileToText(profile), blacklist, tierOverrides };
}

/** Insert or merge a raw job. Returns the job id and whether it is new. */
export async function upsertJob(db: SupabaseClient, userId: string, raw: RawJob): Promise<{ id: string; isNew: boolean }> {
  const fingerprint = jobFingerprint(raw.company, raw.title);
  const now = new Date().toISOString();

  const { data: existing } = await db
    .from("jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  let id: string;
  let isNew = false;
  if (existing) {
    id = existing.id;
    await db.from("jobs").update({ last_seen_at: now, is_open: true }).eq("id", id);
  } else {
    const { data, error } = await db
      .from("jobs")
      .insert({
        user_id: userId,
        fingerprint,
        title: raw.title,
        company: raw.company,
        company_hidden: raw.companyHidden ?? false,
        location: raw.location,
        remote: raw.remote,
        description: raw.description,
        language: detectLanguage(`${raw.title} ${raw.description}`),
        apply_email: raw.applyEmail,
        apply_url: raw.applyUrl,
        salary_min: raw.salaryMin ?? null,
        salary_max: raw.salaryMax ?? null,
        posted_at: raw.postedAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert job: ${error.message}`);
    id = data.id;
    isNew = true;
  }

  await db
    .from("job_sources")
    .upsert(
      { job_id: id, source: raw.source, external_id: raw.externalId, url: raw.url, fetched_at: now },
      { onConflict: "job_id,source,external_id" },
    );
  return { id, isNew };
}

// One research attempt per company per process: concurrent jobs share the same
// promise, and a failure is not retried for every job of that company (cost guard).
const cardInFlight = new Map<string, Promise<CompanyCard | null>>();

function getCompanyCard(db: SupabaseClient, company: string): Promise<CompanyCard | null> {
  const key = normalizeCompanyName(company);
  let p = cardInFlight.get(key);
  if (!p) {
    p = loadOrResearchCard(db, company, key, false);
    cardInFlight.set(key, p);
  }
  return p;
}

/**
 * Company rating card for the companies screen. `db` must be the service-role client
 * (cards are a shared cache that signed-in users can only read). `force` re-researches.
 */
export function ensureCompanyCard(db: SupabaseClient, company: string, force = false): Promise<CompanyCard | null> {
  return loadOrResearchCard(db, company, normalizeCompanyName(company), force);
}

async function loadOrResearchCard(db: SupabaseClient, company: string, key: string, force: boolean): Promise<CompanyCard | null> {
  const { data } = await db.from("company_cards").select("*").eq("company_name", key).maybeSingle();
  if (!force && data && new Date(data.expires_at) > new Date()) return data as CompanyCard;
  if (!process.env.ANTHROPIC_API_KEY) return (data as CompanyCard) ?? null;
  try {
    const card = await researchCompany(company);
    await db.from("company_cards").upsert({
      ...card,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 86400_000).toISOString(),
    });
    return card;
  } catch (e) {
    console.warn(`company card failed for ${company}:`, (e as Error).message);
    return (data as CompanyCard) ?? null;
  }
}

/** Commute from home to a job/company location, cached. Writes the cache only with the service-role client. */
export function commuteFor(db: SupabaseClient, origin: string, location: string | null): Promise<Commute> {
  return getCommute(db, origin, location);
}

async function getCommute(db: SupabaseClient, origin: string, location: string | null): Promise<Commute> {
  const dest = destinationFor(location);
  if (!dest) return { driveMin: null, transitMin: null };
  const { data } = await db.from("commute_cache").select("*").eq("origin", origin).eq("destination", dest).maybeSingle();
  if (data) return { driveMin: data.drive_min, transitMin: data.transit_min };
  if (!process.env.GOOGLE_MAPS_API_KEY) return { driveMin: null, transitMin: null };
  const c = await computeCommute(origin, dest);
  if (c.driveMin != null || c.transitMin != null) {
    await db.from("commute_cache").upsert({ origin, destination: dest, drive_min: c.driveMin, transit_min: c.transitMin });
  }
  return c;
}

export type ProcessResult = "filtered" | "scored" | "skipped" | "too_old";

/** Run filters + scoring for one stored job. */
export async function processJob(
  db: SupabaseClient,
  ctx: UserContext,
  jobId: string,
  raw: RawJob,
  opts: { manual?: boolean } = {},
): Promise<ProcessResult> {
  // A job the user added by hand is always scored — only the blacklist still applies.
  const filterReason = hardFilter(raw, ctx.prefs, ctx.blacklist);
  const reason = opts.manual && filterReason !== "blacklist" ? null : filterReason;
  if (reason) {
    await db.from("jobs").update({ filtered_out: reason }).eq("id", jobId);
    return "filtered";
  }

  // Too old: not marked as filtered, so raising the limit in settings brings it back
  // (it gets scored on the next scan). Saves AI cost on stale postings.
  if (!opts.manual && isTooOld(raw.postedAt, ctx.prefs.max_job_age_days)) return "too_old";

  const commute = await getCommute(db, ctx.prefs.home_address, raw.location);
  const best = bestCommute(commute);
  const limit = raw.remote === "hybrid" ? ctx.prefs.max_commute_min + 15 : ctx.prefs.max_commute_min;
  if (!opts.manual && raw.remote !== "remote" && best != null && best > limit) {
    await db.from("jobs").update({ filtered_out: "commute" }).eq("id", jobId);
    return "filtered";
  }

  if (!process.env.ANTHROPIC_API_KEY) return "skipped";

  const card = raw.companyHidden ? null : await getCompanyCard(db, raw.company);
  const assessment = await assessJob(raw, ctx.profileText, ctx.prefs);
  const override = ctx.tierOverrides.get(normalizeCompanyName(raw.company)) ?? null;
  const employment = card?.is_staffing && assessment.employment === "direct" ? "contractor" : assessment.employment;
  const stability = stabilityScore(card, override, employment);
  const breakdown = buildBreakdown(assessment, commuteScore(commute, raw.remote, ctx.prefs.max_commute_min), stability, ctx.prefs.target_salary);
  const total = combine(breakdown, ctx.prefs.weights);

  const { count: sourceCount } = await db.from("job_sources").select("id", { count: "exact", head: true }).eq("job_id", jobId);

  await db.from("job_scores").upsert({
    job_id: jobId,
    total,
    breakdown: { ...breakdown, employment, domain_name: assessment.domain, required_years: assessment.required_years, hidden_client_guess: assessment.hidden_client_guess, tier: override ?? card?.tier ?? null },
    explanation: assessment.explanation_he,
    missing_skills: assessment.missing_skills.slice(0, 5),
    tags: tagsFor({
      tier: override ?? card?.tier ?? null,
      employment,
      hebrewEnv: assessment.hebrew_env,
      remote: raw.remote,
      postedAt: raw.postedAt,
      sourceCount: sourceCount ?? 1,
    }),
    salary_estimate: assessment.salary_estimate_ils,
    commute_transit_min: commute.transitMin,
    commute_drive_min: commute.driveMin,
    model: MODEL_SCORING,
    scored_at: new Date().toISOString(),
  });
  await db.from("jobs").update({ filtered_out: null }).eq("id", jobId);
  return "scored";
}
