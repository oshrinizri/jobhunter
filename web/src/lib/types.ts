// Shared domain types for JobHunter.

export type JobSourceKind =
  | "greenhouse"
  | "lever"
  | "comeet"
  | "linkedin_email"
  | "manual"
  | "alljobs"
  | "drushim";

/** A job as returned by any connector, before dedup / scoring. */
export interface RawJob {
  source: JobSourceKind;
  externalId: string;
  url: string;
  title: string;
  company: string;
  companyHidden?: boolean;
  location: string | null;
  remote: "onsite" | "hybrid" | "remote" | "unknown";
  description: string; // plain text
  applyEmail: string | null;
  applyUrl: string | null;
  postedAt: string | null; // ISO
  salaryMin?: number | null;
  salaryMax?: number | null;
}

export type Tier = "A" | "B" | "C";

export interface Weights {
  skills: number;
  role: number;
  commute: number;
  stability: number;
  salary: number;
  domain: number;
  hebrew: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  skills: 30,
  role: 20,
  commute: 15,
  stability: 15,
  salary: 10,
  domain: 5,
  hebrew: 5,
};

export interface Preferences {
  home_address: string;
  max_commute_min: number;
  target_salary: number;
  role_tracks: string[];
  weights: Weights;
  preferred_domains: string[];
  negative_keywords: string[];
  preference_notes: string;
  /** Jobs posted longer ago than this are hidden and not scored (manual adds excepted). */
  max_job_age_days: number;
  /** Automatic scans: on/off, Israel-time hours (from SCAN_SLOTS) and days of week (0 = Sunday). */
  scan_enabled: boolean;
  scan_hours: number[];
  scan_days: number[];
  /** Research new companies automatically during scans (the costly AI step). */
  auto_company_research: boolean;
}

export const DEFAULT_MAX_JOB_AGE_DAYS = 30;

/** Hours (Israel time) at which the scheduler wakes up — must match .github/workflows/ingest.yml. */
export const SCAN_SLOTS = [7, 12, 17, 21] as const;

export const SCAN_DEFAULTS = {
  scan_enabled: true,
  scan_hours: [7, 17],
  scan_days: [0, 1, 2, 3, 4],
  auto_company_research: true,
};

/** The scan slot and weekday "now" in Israel, snapping to the nearest slot (the scheduler can run a bit early or late). */
export function currentScanSlot(now = new Date()): { slot: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) + Number(parts.find((p) => p.type === "minute")?.value ?? 0) / 60;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((p) => p.type === "weekday")?.value ?? "Sun");
  const slot = [...SCAN_SLOTS].sort((a, b) => Math.abs(a - hour) - Math.abs(b - hour))[0];
  return { slot, day };
}

/** True when a posting date is older than the user's age limit. Unknown dates pass. */
export function isTooOld(postedAt: string | null | undefined, maxDays: number | null | undefined): boolean {
  if (!postedAt || !maxDays) return false;
  return Date.now() - new Date(postedAt).getTime() > maxDays * 86400_000;
}

/** ISO cutoff for "posted within the last N days". */
export function ageCutoffIso(maxDays: number): string {
  return new Date(Date.now() - maxDays * 86400_000).toISOString();
}

export interface CompanyCard {
  company_name: string;
  tier: Tier;
  is_public: boolean | null;
  employees: number | null;
  founded_year: number | null;
  funding_stage: string | null;
  recent_layoffs: boolean | null;
  sector: string | null;
  hq_country: string | null;
  work_language: "he" | "en" | "mixed" | null;
  is_staffing: boolean;
  summary: string | null;
}

export interface Commute {
  transitMin: number | null;
  driveMin: number | null;
}

export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "screening",
  "interview",
  "home_task",
  "offer",
  "hired",
  "rejected",
  "no_response",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "שמורה",
  applied: "הוגשה",
  screening: "בתהליך מיון",
  interview: "ראיון",
  home_task: "מטלת בית",
  offer: "הצעה",
  hired: "התקבלתי",
  rejected: "נדחיתי",
  no_response: "לא ענו",
  withdrawn: "משכתי",
};
