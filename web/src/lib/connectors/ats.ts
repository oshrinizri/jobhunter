// Public ATS job-board connectors: Greenhouse, Lever, Comeet.
// All three expose public, unauthenticated JSON endpoints meant for career pages.

import type { RawJob } from "../types";
import { detectRemote, extractEmail, htmlToText, isIsraelLocation } from "../text";

const UA = "JobHunter/0.1 (personal job search)";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Greenhouse — https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
// ---------------------------------------------------------------------------

interface GhJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  first_published?: string;
  updated_at?: string;
  company_name?: string;
}

export async function fetchGreenhouse(board: string, companyName: string): Promise<RawJob[]> {
  const data = await getJson<{ jobs: GhJob[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`,
  );
  return data.jobs.map((j) => {
    const description = htmlToText(j.content);
    const location = j.location?.name ?? null;
    return {
      source: "greenhouse",
      externalId: String(j.id),
      url: j.absolute_url,
      title: j.title.trim(),
      company: companyName,
      location,
      remote: detectRemote(`${location ?? ""} ${j.title} ${description.slice(0, 4000)}`),
      description,
      applyEmail: null,
      applyUrl: j.absolute_url,
      postedAt: j.first_published ?? j.updated_at ?? null,
    } satisfies RawJob;
  });
}

// ---------------------------------------------------------------------------
// Lever — https://api.lever.co/v0/postings/{slug}?mode=json
// ---------------------------------------------------------------------------

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  categories?: { location?: string; allLocations?: string[]; team?: string; commitment?: string };
  descriptionPlain?: string;
  lists?: { text: string; content: string }[];
  additionalPlain?: string;
}

export async function fetchLever(slug: string, companyName: string): Promise<RawJob[]> {
  const data = await getJson<LeverPosting[]>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`,
  );
  return data.map((p) => {
    const lists = (p.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
    const description = [p.descriptionPlain, lists, p.additionalPlain].filter(Boolean).join("\n\n").trim();
    const location = p.categories?.allLocations?.join(" / ") ?? p.categories?.location ?? null;
    const wt = p.workplaceType?.toLowerCase();
    return {
      source: "lever",
      externalId: p.id,
      url: p.hostedUrl,
      title: p.text.trim(),
      company: companyName,
      location,
      remote:
        wt === "remote" ? "remote" : wt === "hybrid" ? "hybrid" : wt === "onsite" ? "onsite" : detectRemote(location ?? ""),
      description,
      applyEmail: null,
      applyUrl: p.applyUrl ?? p.hostedUrl,
      postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    } satisfies RawJob;
  });
}

// ---------------------------------------------------------------------------
// Comeet — https://www.comeet.co/careers-api/2.0/company/{uid}/positions?token={token}&details=true
// The uid + token are public: they are embedded in every Comeet-powered career page.
// ---------------------------------------------------------------------------

interface ComeetPosition {
  uid: string;
  name: string;
  location?: { name?: string; city?: string; country?: string; is_remote?: boolean } | null;
  workplace_type?: string | null;
  url_comeet_hosted_page?: string;
  url_active_page?: string;
  time_updated?: string;
  details?: { name: string; value: string }[];
  company_name?: string;
}

export async function fetchComeet(uid: string, token: string, companyName: string): Promise<RawJob[]> {
  const data = await getJson<ComeetPosition[]>(
    `https://www.comeet.co/careers-api/2.0/company/${encodeURIComponent(uid)}/positions?token=${encodeURIComponent(token)}&details=true`,
  );
  return data.map((p) => {
    const description = (p.details ?? []).map((d) => `${d.name}\n${htmlToText(d.value)}`).join("\n\n");
    const loc = p.location;
    const location = loc ? [loc.city, loc.country].filter(Boolean).join(", ") || loc.name || null : null;
    const url = p.url_active_page || p.url_comeet_hosted_page || "";
    const wt = p.workplace_type?.toLowerCase() ?? "";
    return {
      source: "comeet",
      externalId: p.uid,
      url,
      title: p.name.trim(),
      company: companyName,
      location,
      remote: loc?.is_remote ? "remote" : wt.includes("hybrid") ? "hybrid" : wt.includes("site") ? "onsite" : "unknown",
      description,
      applyEmail: extractEmail(description),
      applyUrl: url,
      postedAt: p.time_updated ?? null,
    } satisfies RawJob;
  });
}

/**
 * Given a Comeet career-page URL or HTML, pull out the public uid + token.
 * Used when adding a company: paste its careers page, we find the board.
 */
export function parseComeetConfig(html: string): { uid: string; token: string } | null {
  const uid = html.match(/company[_-]?uid["']?\s*[:=]\s*["']([0-9A-F]{2}\.[0-9A-F]{3})["']/i)?.[1];
  const token = html.match(/["']?token["']?\s*[:=]\s*["']([0-9A-F]{16,})["']/i)?.[1];
  return uid && token ? { uid, token } : null;
}

// ---------------------------------------------------------------------------

export interface CompanyBoard {
  name: string;
  ats: "greenhouse" | "lever" | "comeet" | "none" | null;
  ats_board: string | null;
  ats_token: string | null;
}

/** Fetch a company's open jobs and keep only those located in Israel. */
export async function fetchCompanyJobs(c: CompanyBoard): Promise<RawJob[]> {
  let jobs: RawJob[] = [];
  if (c.ats === "greenhouse" && c.ats_board) jobs = await fetchGreenhouse(c.ats_board, c.name);
  else if (c.ats === "lever" && c.ats_board) jobs = await fetchLever(c.ats_board, c.name);
  else if (c.ats === "comeet" && c.ats_board && c.ats_token) jobs = await fetchComeet(c.ats_board, c.ats_token, c.name);
  return jobs.filter((j) => isIsraelLocation(j.location));
}

/** Try to auto-detect which public board a company uses, by slug guesses. */
export async function detectBoard(slug: string): Promise<{ ats: "greenhouse" | "lever"; board: string; count: number } | null> {
  try {
    const gh = await getJson<{ jobs: unknown[] }>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
    return { ats: "greenhouse", board: slug, count: gh.jobs.length };
  } catch {}
  try {
    const lv = await getJson<unknown[]>(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    return { ats: "lever", board: slug, count: lv.length };
  } catch {}
  return null;
}
