import Anthropic from "@anthropic-ai/sdk";

// Models (chosen in SPEC §14 for lowest cost):
//  - Haiku 5.5: bulk job scoring (cheap, fast)
//  - Sonnet 5.5: company cards with web search, CV tailoring, enrichment interview
export const MODEL_SCORING = "claude-haiku-5-5";
export const MODEL_WRITING = "claude-sonnet-5-5";

let client: Anthropic | null = null;

export function ai(): Anthropic {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY
  return client;
}

/** Concatenate the text blocks of a response. */
export function textOf(content: { type: string; text?: string }[]): string {
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

/** Pull the last JSON object out of a model's text answer. */
export function extractJson(text: string): unknown {
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].pop()?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(candidate);
}
