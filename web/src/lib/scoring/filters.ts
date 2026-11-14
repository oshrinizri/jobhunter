// Hard filters — cheap checks that run before any AI call (SPEC §6.1).

import type { Preferences, RawJob } from "../types";

// Titles that clearly belong to one of the four target tracks.
const TRACK_PATTERNS: Record<string, RegExp> = {
  "Data Analyst": /data analyst|analytics|אנליסט|אנליטיק|business analyst|insights?|bi analyst|reporting analyst|דאטה|נתונים/i,
  "BI Developer": /\bbi\b|business intelligence|bi developer|qlik|power ?bi|tableau|looker|מפתח bi/i,
  "Data Engineer": /data engineer|etl|data platform|dwh|data warehouse|מהנדס נתונים|הנדסת נתונים/i,
  "Product Analyst": /product analyst|growth analyst|אנליסט מוצר/i,
  "AI & Data": /\bai\b|artificial intelligence|gen ?ai|\bllm|machine learning|\bml\b|data scien|\bnlp\b|nl2sql|בינה מלאכותית/i,
};

// Pure software / research titles that mention AI but are not data roles — not worth an AI scoring call.
const NOT_DATA_ROLE = /software|backend|back-end|front ?end|full ?stack|devops|hardware|firmware|research scientist|researcher|algorithm developer|mlops|android|ios developer/i;

export const ROLE_TRACKS = Object.keys(TRACK_PATTERNS);

function matchesTrack(track: string, title: string): boolean {
  const re = TRACK_PATTERNS[track];
  if (!re?.test(title)) return false;
  if (track === "AI & Data" && NOT_DATA_ROLE.test(title)) return false;
  return true;
}

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

  if (!prefs.role_tracks.some((t) => matchesTrack(t, title))) return "role";
  return null;
}
