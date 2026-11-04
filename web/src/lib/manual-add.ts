// Add a single job from a link (iOS Shortcut / share) or pasted text.
// Known ATS links use their JSON API; anything else is read and extracted by the AI.

import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ai, MODEL_SCORING } from "./ai";
import { detectRemote, extractEmail, htmlToText } from "./text";
import type { RawJob } from "./types";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const Extracted = z.object({
  is_job_posting: z.boolean(),
  title: z.string(),
  company: z.string().describe("Hiring company. If posted by a staffing agency for an unnamed client, the agency name"),
  company_hidden: z.boolean().describe("true if the real employer is not named (agency posting)"),
  location: z.string().nullable(),
  apply_email: z.string().nullable(),
  description: z.string().describe("The full job description and requirements, cleaned, in the original language"),
});

async function fromGreenhouse(url: string): Promise<RawJob | null> {
  const m = url.match(/greenhouse\.io\/(?:embed\/job_app\?for=)?([\w-]+)\/jobs\/(\d+)/);
  if (!m) return null;
  const [, board, id] = m;
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}?content=true`);
  if (!res.ok) return null;
  const j = await res.json();
  const description = htmlToText(j.content);
  return {
    source: "manual", externalId: `gh:${id}`, url, title: j.title, company: j.company_name ?? board,
    location: j.location?.name ?? null, remote: detectRemote(`${j.location?.name ?? ""} ${description.slice(0, 4000)}`),
    description, applyEmail: null, applyUrl: j.absolute_url ?? url, postedAt: j.first_published ?? j.updated_at ?? null,
  };
}

async function fromLever(url: string): Promise<RawJob | null> {
  const m = url.match(/jobs\.lever\.co\/([\w-]+)\/([0-9a-f-]{36})/);
  if (!m) return null;
  const [, slug, id] = m;
  const res = await fetch(`https://api.lever.co/v0/postings/${slug}/${id}?mode=json`);
  if (!res.ok) return null;
  const p = await res.json();
  const lists = (p.lists ?? []).map((l: { text: string; content: string }) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
  const description = [p.descriptionPlain, lists, p.additionalPlain].filter(Boolean).join("\n\n");
  return {
    source: "manual", externalId: `lever:${id}`, url, title: p.text, company: slug,
    location: p.categories?.location ?? null, remote: detectRemote(p.workplaceType ?? p.categories?.location ?? ""),
    description, applyEmail: null, applyUrl: p.applyUrl ?? url, postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
  };
}

async function fetchPageText(url: string): Promise<string> {
  const u = new URL(url);
  // Only public web pages — never internal addresses.
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1|0\.)/i.test(u.hostname)) {
    throw new Error("כתובת לא נתמכת");
  }
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "he,en" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`הדף לא נטען (${res.status})`);
  const html = await res.text();
  // Prefer structured JobPosting data when the page has it.
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n");
  const body = htmlToText(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ""));
  return `${ld.includes("JobPosting") ? `STRUCTURED DATA:\n${ld.slice(0, 15000)}\n\n` : ""}PAGE TEXT:\n${body.slice(0, 30000)}`;
}

export async function rawJobFromInput(url: string | null, pastedText: string | null): Promise<RawJob> {
  if (url) {
    const ats = (await fromGreenhouse(url)) ?? (await fromLever(url));
    if (ats) return ats;
  }

  let text = pastedText?.trim() ?? "";
  if (!text && url) text = await fetchPageText(url);
  if (!text) throw new Error("צריך לינק או טקסט של המשרה");

  const res = await ai().messages.parse({
    model: MODEL_SCORING,
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(Extracted) },
    messages: [{ role: "user", content: `Extract the job posting from this content.${url ? `\nSource URL: ${url}` : ""}\n\n${text}` }],
  });
  const e = res.parsed_output;
  if (!e || !e.is_job_posting) throw new Error("לא זוהתה משרה בדף. אפשר להדביק את טקסט המשרה ידנית.");

  return {
    source: url && /linkedin\.com/i.test(url) ? "linkedin_email" : "manual",
    externalId: url ?? `text:${Date.now()}`,
    url: url ?? "",
    title: e.title,
    company: e.company,
    companyHidden: e.company_hidden,
    location: e.location,
    remote: detectRemote(`${e.location ?? ""} ${e.description.slice(0, 4000)}`),
    description: e.description,
    applyEmail: e.apply_email ?? extractEmail(e.description),
    applyUrl: url,
    postedAt: null,
  };
}
