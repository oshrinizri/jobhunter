// On-demand Hebrew translation of job descriptions (cheap model; ~0.1¢ per job).
import { ai, MODEL_SCORING, textOf } from "./ai";

export async function translateToHebrew(text: string): Promise<string> {
  const res = await ai().messages.create({
    model: MODEL_SCORING,
    max_tokens: 10000,
    output_config: { effort: "low" },
    system:
      "Translate the job posting into natural, fluent Hebrew. Keep the structure (headings, bullet lines). " +
      "Keep technology, tool and product names in English (SQL, Python, Airflow, AWS...). Keep the company name as is. " +
      "Plain text only — no markdown symbols (no **, #, or backticks); keep bullet characters like • or - as in the source. " +
      "Output only the translation, no preface.",
    messages: [{ role: "user", content: text.slice(0, 15000) }],
  });
  const out = textOf(res.content).trim();
  if (!out) throw new Error(`translation failed (${res.stop_reason})`);
  return out;
}
