// Company card: stability tier + facts, researched once with web search, cached 90 days.

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ai, extractJson, MODEL_WRITING, textOf } from "../ai";
import type { CompanyCard } from "../types";
import { normalizeCompanyName } from "../text";

// The card comes from free-text JSON after web search, so be forgiving:
// "yes"/"no"/"unknown" → boolean/null, "1,500+" → 1500, unknown strings → null.
const looseBool = z.preprocess((v) => {
  if (typeof v === "boolean" || v == null) return v ?? null;
  const s = String(v).trim().toLowerCase();
  if (/^(true|yes|כן)\b/.test(s)) return true;
  if (/^(false|no|none|לא)\b/.test(s)) return false;
  return null;
}, z.boolean().nullable());
const looseInt = z.preprocess((v) => {
  if (typeof v === "number" || v == null) return v == null ? null : Math.round(v);
  const m = String(v).replace(/,/g, "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}, z.number().int().nullable());
const looseStr = z.preprocess((v) => (v == null ? null : String(v)), z.string().nullable());

const CardSchema = z.object({
  tier: z.preprocess((v) => String(v ?? "").trim().toUpperCase().charAt(0), z.enum(["A", "B", "C"])),
  is_public: looseBool,
  employees: looseInt,
  founded_year: looseInt,
  funding_stage: looseStr,
  recent_layoffs: looseBool,
  sector: looseStr,
  hq_country: looseStr,
  work_language: z.preprocess(
    (v) => (["he", "en", "mixed"].includes(String(v)) ? v : null),
    z.enum(["he", "en", "mixed"]).nullable(),
  ),
  is_staffing: looseBool.transform((b) => b ?? false),
  summary: looseStr,
});

const SYSTEM = `You research Israeli employers for a job seeker and classify their stability.

Tiers:
- A (very stable): publicly traded or large (1000+ employees), bank, insurance, government, defense, large healthcare organization.
- B (stable): established profitable private company, or a startup at Series B or later / 50+ employees with solid funding.
- C (risk): seed/pre-seed or very early startup, OR any company with layoffs in the last 12 months.

Also determine:
- work_language: the day-to-day working language at the company's Israeli site. "he" for Israeli-headquartered companies whose teams work in Hebrew, "en" when the Israeli site is a branch of a foreign company or teams are mostly global, "mixed" otherwise.
- is_staffing: true if the company is a staffing, placement, outsourcing or consulting firm that places employees at clients (e.g. Ethosia, Nisha, SQLink, Matrix, Malam Team, G-STAT).

Use web search to check recent facts (funding, layoffs, size). Be concise.
Finish with a single JSON object in a \`\`\`json block with exactly these keys:
tier, is_public, employees, founded_year, funding_stage, recent_layoffs, sector, hq_country, work_language, is_staffing, summary (summary: 1–2 sentences in Hebrew).
Use null for anything you could not verify.`;

export async function researchCompany(name: string): Promise<CompanyCard> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Company: ${name}\nCountry context: Israel` },
  ];

  // Web search may pause a long turn; resend until the model finishes (bounded).
  for (let i = 0; i < 4; i++) {
    const res = await ai().beta.messages.create({
      model: MODEL_WRITING,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
      // Refusal safety net: route to a fallback model automatically.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages,
    });

    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "refusal") throw new Error(`company card refused for ${name}`);

    const parsed = CardSchema.parse(extractJson(textOf(res.content)));
    return { company_name: normalizeCompanyName(name), ...parsed };
  }
  throw new Error(`company card for ${name} did not finish`);
}

/** Stability sub-score (0–100) from the card and employment type. */
export function stabilityScore(
  card: Pick<CompanyCard, "tier"> | null,
  tierOverride: "A" | "B" | "C" | null,
  employment: "direct" | "contractor" | "agency_unknown",
): number {
  const tier = tierOverride ?? card?.tier ?? null;
  let s = tier === "A" ? 100 : tier === "B" ? 80 : tier === "C" ? 35 : 60;
  if (employment === "agency_unknown" && !tierOverride) s = 60; // hidden client: neutral
  if (employment === "contractor") s = Math.max(0, s - 40); // spec: direct employment preferred
  return s;
}
