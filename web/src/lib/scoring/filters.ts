// Hard filters — cheap checks that run before any AI call (SPEC §6.1).

import type { Preferences, RawJob } from "../types";

// Titles that clearly belong to one of the four target tracks.
const TRACK_PATTERNS: Record<string, RegExp> = {
  "Data Analyst": /data analyst|analytics|אנליסט|אנליטיק|business analyst|insights?|bi analyst|reporting analyst|דאטה|נתונים/i,
  "BI Developer": /\bbi\b|business intelligence|bi developer|qlik|power ?bi|tableau|looker|מפתח bi/i,
  "Data Engineer": /data engineer|etl|data platform|dwh|data warehouse|מהנדס נתונים|הנדסת נתונים/i,
  "Product Analyst": /product analyst|growth analyst|אנליסט מוצר/i,
};

const TOO_SENIOR = /\b(director|vp|head of|principal|staff|chief|group manager|team lead(er)?|tech lead|engineering manager|manager)\b|סמנכ"ל|ראש תחום|ראש צוות|מנהל(ת)? צוות|דירקטור/i;
const TOO_JUNIOR = /\b(intern|internship|student|junior student)\b|סטודנט|משרת סטודנט|מתמחה/i;

export function hardFilter(job: RawJob, prefs: Preferences, blacklist: string[]): string | null {
  const company = job.company.toLowerCase();
  if (blacklist.some((b) => company.includes(b.toLowerCase()))) return "blacklist";
  // Staffing posts naming a blacklisted client in the text (e.g. "for Bank Hapoalim").
  const text = `${job.title}\n${job.description}`.toLowerCase();
  if (blacklist.some((b) => b.length > 3 && text.includes(b.toLowerCase()))) return "blacklist";

  const title = job.title;
  if (prefs.negative_keywords.some((k) => k && title.toLowerCase().includes(k.toLowerCase()))) return "keyword";
  if (TOO_SENIOR.test(title)) return "seniority";
  if (TOO_JUNIOR.test(title)) return "seniority";

  const matchesTrack = prefs.role_tracks.some((t) => TRACK_PATTERNS[t]?.test(title));
  if (!matchesTrack) return "role";
  return null;
}
