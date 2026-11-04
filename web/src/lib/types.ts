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
