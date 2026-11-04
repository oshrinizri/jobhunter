// AI job assessment (Haiku) + deterministic weighted total (SPEC §6.2).
//
// The model judges only what needs judgement (skills fit, role fit, salary estimate, domain,
// working language, employment type). Commute and stability come from data, and the
// weighting happens in code — so changing weights in Settings re-ranks instantly, no AI call.

import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ai, MODEL_SCORING } from "../ai";
import type { Preferences, RawJob, Weights } from "../types";

export const AssessmentSchema = z.object({
  skills_fit: z.number().describe("0-100: how well the candidate's proven skills cover the job requirements"),
  role_fit: z.number().describe("0-100: fit of title/seniority/years required to the candidate's level and target tracks"),
  required_years: z.number().nullable(),
  missing_skills: z.array(z.string()).describe("Required skills/tools the candidate does not have, max 5"),
  salary_estimate_ils: z.number().nullable().describe("Estimated gross monthly salary in ILS for this role in Israel"),
  domain: z.string().describe("Industry, e.g. fintech, health, adtech, cyber, gaming, government"),
  domain_fit: z.number().describe("0-100: match to the candidate's preferred domains"),
  hebrew_env: z.number().describe("0-100: 100 = Hebrew-speaking workplace; low if native English, global team or US hours required"),
  employment: z.enum(["direct", "contractor", "agency_unknown"]).describe(
    "direct = hired by the company itself; contractor = employed via outsourcing/staffing firm and placed at a client; agency_unknown = posted by a placement agency for an unnamed client",
  ),
  hidden_client_guess: z.string().nullable().describe("If posted by an agency for an unnamed client, best guess of the client, with confidence"),
  explanation_he: z.string().describe("2-4 short lines in Hebrew: why this score, main strengths, main gaps"),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

function systemPrompt(profileText: string, prefs: Preferences): string {
  return `You evaluate job postings for one specific candidate in Israel. Be calibrated and honest:
do not inflate fit. A skill counts only if it appears in the candidate profile below.

# Candidate profile
${profileText}

# Candidate preferences
- Target tracks: ${prefs.role_tracks.join(", ")}
- Current salary: ${prefs.target_salary} ILS/month gross — wants at least this
- Preferred domains: ${prefs.preferred_domains.join(", ") || "none"}
- Prefers a Hebrew-speaking workplace over global English-speaking teams
- Prefers direct employment over outsourcing/contractor placements
${prefs.preference_notes ? `- Learned preferences:\n${prefs.preference_notes}` : ""}

# Scoring guide
skills_fit: 90+ only if nearly every hard requirement is covered; ~50 if core SQL/BI fits but key tools are missing; <30 if the job is mostly a different skill set.
role_fit: penalize clearly when required years exceed the candidate's experience by 3+ or the role is far more junior.
explanation_he: Hebrew, 2-4 short lines, concrete (name the tools).`;
}

export async function assessJob(job: RawJob, profileText: string, prefs: Preferences): Promise<Assessment> {
  const res = await ai().messages.parse({
    model: MODEL_SCORING,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(AssessmentSchema) },
    system: [{ type: "text", text: systemPrompt(profileText, prefs), cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `# Job posting\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location ?? "unknown"} (${job.remote})\n\n${job.description.slice(0, 12000)}`,
      },
    ],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) {
    throw new Error(`assessment failed for "${job.title}" (${res.stop_reason})`);
  }
  return res.parsed_output;
}

// ---------------------------------------------------------------------------

export interface Breakdown {
  skills: number;
  role: number;
  commute: number;
  stability: number;
  salary: number;
  domain: number;
  hebrew: number;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function salaryScore(estimate: number | null, target: number): number {
  if (estimate == null) return 60;
  if (estimate >= target + 3000) return 100;
  if (estimate >= target) return 85;
  if (estimate >= target - 2000) return 60;
  return 30;
}

export function combine(b: Breakdown, w: Weights): number {
  const total = Object.values(w).reduce((a, x) => a + x, 0) || 1;
  const sum =
    b.skills * w.skills +
    b.role * w.role +
    b.commute * w.commute +
    b.stability * w.stability +
    b.salary * w.salary +
    b.domain * w.domain +
    b.hebrew * w.hebrew;
  return clamp(sum / total);
}

export function buildBreakdown(a: Assessment, commute: number, stability: number, target: number): Breakdown {
  return {
    skills: clamp(a.skills_fit),
    role: clamp(a.role_fit),
    commute: clamp(commute),
    stability: clamp(stability),
    salary: salaryScore(a.salary_estimate_ils, target),
    domain: clamp(a.domain_fit),
    hebrew: clamp(a.hebrew_env),
  };
}

export function tagsFor(opts: {
  tier: "A" | "B" | "C" | null;
  employment: Assessment["employment"];
  hebrewEnv: number;
  remote: string;
  postedAt: string | null;
  sourceCount: number;
}): string[] {
  const tags: string[] = [];
  if (opts.tier === "C") tags.push("risk");
  if (opts.employment === "contractor") tags.push("contractor");
  if (opts.employment === "agency_unknown") tags.push("hidden_company");
  if (opts.hebrewEnv < 50) tags.push("english");
  if (opts.remote === "hybrid" || opts.remote === "remote") tags.push("hybrid");
  if (opts.postedAt && Date.now() - new Date(opts.postedAt).getTime() < 3 * 86400_000) tags.push("new");
  if (opts.sourceCount > 1) tags.push("multi_source");
  return tags;
}
