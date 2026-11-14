// Base CV + enrichment interview. Rules (SPEC §8): the master profile is the only source of truth —
// the AI may select, order and rephrase, never invent skills, roles, numbers or scope.

import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ai, MODEL_WRITING } from "./ai";
import { PROFILE_KINDS, type ProfileItem } from "./profile-seed";

// ---------------------------------------------------------------------------
// CV document
// ---------------------------------------------------------------------------

export const CvContact = z.object({
  name: z.string(),
  headline: z.string(),
  phone: z.string(),
  email: z.string(),
  city: z.string(),
  linkedin: z.string(),
});
export type CvContact = z.infer<typeof CvContact>;

export const EMPTY_CONTACT: CvContact = { name: "", headline: "", phone: "", email: "", city: "", linkedin: "" };

const CvBody = z.object({
  headline: z.string().describe("Professional title line under the name, e.g. 'Data Analyst | SQL · BI · Banking'"),
  summary: z.string().describe("3–4 line professional summary"),
  experience: z.array(
    z.object({
      title: z.string(),
      org: z.string(),
      period: z.string().describe("e.g. '07/2021 – 09/2022' or '2023 – Present' (Hebrew: 'היום')"),
      bullets: z.array(z.string()).describe("3–5 achievement-oriented bullets"),
    }),
  ),
  education: z.array(z.object({ title: z.string(), org: z.string(), period: z.string(), details: z.string() })),
  courses: z.array(z.object({ title: z.string(), org: z.string(), period: z.string() })),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  languages: z.array(z.string()),
  military: z.string().describe("One line, or empty string"),
});
export type CvBody = z.infer<typeof CvBody>;

export interface CvDoc extends CvBody {
  contact: CvContact;
  generated_at: string;
}

export function profileForPrompt(items: ProfileItem[]): string {
  return items
    .map((i, n) => {
      const when = i.start_date ? ` (${i.start_date.slice(0, 7)} – ${i.end_date ? i.end_date.slice(0, 7) : "present"})` : "";
      const tags = i.tags?.length ? `\nTags: ${i.tags.join(", ")}` : "";
      return `#${n + 1} [${i.kind}] ${i.title}${i.org ? ` — ${i.org}` : ""}${when}\n${i.details}${tags}`;
    })
    .join("\n\n");
}

const CV_RULES = `Hard rules:
- Use ONLY facts in the profile. Never add a skill, tool, role, project, number or responsibility that is not there.
- You may select, reorder, merge and rephrase; you may omit weak or irrelevant items.
- Skill levels must stay honest (e.g. "Python (basic)" stays basic).
- ATS-friendly: plain wording, standard section names, no tables or graphics, keywords spelled out.
- Fit on 1–2 pages: summary 3–4 lines, 3–5 bullets per recent role, fewer for older roles.`;

/** Write the base (general) CV in Hebrew or English from the master profile. */
export async function generateBaseCv(items: ProfileItem[], lang: "he" | "en", targetRoles: string[]): Promise<CvBody> {
  const res = await ai().messages.parse({
    model: MODEL_WRITING,
    max_tokens: 12000,
    output_config: { effort: "medium", format: zodOutputFormat(CvBody) },
    system: `You write strong, honest CVs for the Israeli job market.\n${CV_RULES}\nTarget roles: ${targetRoles.join(", ")}.\nWrite the entire CV in ${lang === "he" ? "Hebrew (keep tool and technology names in English)" : "English"}.`,
    messages: [{ role: "user", content: `Master profile:\n\n${profileForPrompt(items)}` }],
  });
  if (!res.parsed_output) throw new Error(`CV generation failed (${res.stop_reason})`);
  return res.parsed_output;
}

// ---------------------------------------------------------------------------
// Per-job tailoring (SPEC §8.2–8.3)
// ---------------------------------------------------------------------------

const Tailored = z.object({
  cv: CvBody,
  cover_letter: z.string().describe("3–5 lines for the email body, in the CV language, first person, no clichés"),
  changes_he: z.array(z.string()).describe("What was changed vs. a general CV and why — short Hebrew lines"),
  gaps_he: z.array(z.string()).describe("Requirements of the job the profile does not cover — short Hebrew lines, honest"),
});
export type Tailored = z.infer<typeof Tailored>;

export interface TailoredDoc extends CvDoc {
  changes_he: string[];
  gaps_he: string[];
}

/** CV tailored to one job: same facts, re-selected and re-ordered for the posting, plus a short cover letter. */
export async function generateTailoredCv(
  items: ProfileItem[],
  job: { title: string; company: string; description: string },
  lang: "he" | "en",
): Promise<Tailored> {
  const res = await ai().messages.parse({
    model: MODEL_WRITING,
    max_tokens: 14000,
    output_config: { effort: "medium", format: zodOutputFormat(Tailored) },
    system: `You tailor an honest CV to a specific job posting for the Israeli market.
${CV_RULES}
Tailoring: lead with the most relevant experience and skills for THIS job; mirror the posting's terminology only where it is
true for the candidate (helps ATS); drop what is irrelevant; rewrite the headline and summary for this role.
List anything the job requires that the profile lacks in gaps_he — never paper over gaps in the CV.
Write the CV and cover letter in ${lang === "he" ? "Hebrew (keep tool and technology names in English)" : "English"}.`,
    messages: [
      {
        role: "user",
        content: `# Job\nTitle: ${job.title}\nCompany: ${job.company}\n\n${job.description.slice(0, 12000)}\n\n# Master profile\n\n${profileForPrompt(items)}`,
      },
    ],
  });
  if (!res.parsed_output) throw new Error(`tailoring failed (${res.stop_reason})`);
  return res.parsed_output;
}

// ---------------------------------------------------------------------------
// Enrichment interview
// ---------------------------------------------------------------------------

const Questions = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe("Short, concrete question in Hebrew"),
      why: z.string().describe("Half a sentence in Hebrew: what the answer will improve in the CV"),
    }),
  ),
});

/** Ask a few targeted questions that would make the CV stronger (numbers, tools, projects, gaps). */
export async function generateQuestions(items: ProfileItem[], targetRoles: string[], previous: string[], count = 5) {
  const res = await ai().messages.parse({
    model: MODEL_WRITING,
    max_tokens: 6000,
    output_config: { effort: "low", format: zodOutputFormat(Questions) },
    system: `You interview a job seeker to enrich their CV profile. Target roles: ${targetRoles.join(", ")}.
Ask ${count} short questions in Hebrew, each about ONE thing, that would most improve the CV for these roles:
measurable results (numbers, scale, time saved), tools and how they were used, concrete projects, missing dates, Python usage,
domain knowledge. Prefer questions answerable in one or two sentences. Do not repeat earlier questions.`,
    messages: [
      {
        role: "user",
        content: `Profile:\n\n${profileForPrompt(items)}\n\nEarlier questions (do not repeat):\n${previous.join("\n") || "none"}`,
      },
    ],
  });
  return res.parsed_output?.questions ?? [];
}

const ProfileOps = z.object({
  operations: z.array(
    z.object({
      op: z.enum(["add", "update"]),
      item_number: z.number().int().nullable().describe("For update: the #number of the profile item to change"),
      kind: z.enum(PROFILE_KINDS).nullable(),
      title: z.string().nullable(),
      org: z.string().nullable(),
      start_date: z.string().nullable().describe("YYYY-MM-DD or null"),
      end_date: z.string().nullable().describe("YYYY-MM-DD or null"),
      details: z.string().nullable().describe("For update: the FULL new details text (old text plus the new facts)"),
      tags: z.array(z.string()).nullable(),
    }),
  ),
  summary_he: z.array(z.string()).describe("One short Hebrew line per change, for the user"),
});
export type ProfileOps = z.infer<typeof ProfileOps>;

/** Turn interview answers into profile changes, using only what the user actually said. */
export async function answersToOps(items: ProfileItem[], qa: { question: string; answer: string }[]): Promise<ProfileOps> {
  const res = await ai().messages.parse({
    model: MODEL_WRITING,
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(ProfileOps) },
    system: `You update a job seeker's master profile from their interview answers.
Use ONLY facts stated in the answers — do not embellish or infer numbers. Write details in English (the profile language),
concise, CV-ready. Prefer updating an existing item (keep its old text, append the new facts) over adding duplicates.
Add a new item only for something genuinely new (a project, course, skill, language...). Ignore answers like "לא" or "לא זוכר".`,
    messages: [
      {
        role: "user",
        content: `Profile:\n\n${profileForPrompt(items)}\n\nInterview:\n${qa.map((x) => `Q: ${x.question}\nA: ${x.answer}`).join("\n\n")}`,
      },
    ],
  });
  if (!res.parsed_output) throw new Error(`could not read the answers (${res.stop_reason})`);
  return res.parsed_output;
}
