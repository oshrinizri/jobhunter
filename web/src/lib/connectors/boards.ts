// Israeli job boards: Drushim and AllJobs (public search pages, read twice a day at low volume).
// Both render results server-side; we read the search page, and for Drushim the job's JSON-LD for the full text.

import type { RawJob } from "../types";
import { detectRemote, extractEmail, htmlToText } from "../text";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "he,en;q=0.8", Accept: "text/html" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const decode = (s: string) => htmlToText(s).replace(/\s+/g, " ").trim();

/** "לפני 7 שעות", "היום", "אתמול", "2 ימים", "לפני שבוע", "חודש" → ISO date (approximate). */
export function parseHebrewAgo(text: string | null | undefined, now = Date.now()): string | null {
  if (!text) return null;
  const t = text.trim();
  const n = Number(t.match(/\d+/)?.[0] ?? 1);
  const H = 3600_000, D = 24 * H;
  let ms: number | null = null;
  if (/דק/.test(t)) ms = n * 60_000;
  else if (/שע/.test(t)) ms = n * H;
  else if (/היום/.test(t)) ms = 0;
  else if (/אתמול/.test(t)) ms = D;
  else if (/שבוע/.test(t)) ms = (/\d/.test(t) ? n : 1) * 7 * D;
  else if (/חודש/.test(t)) ms = (/\d/.test(t) ? n : 1) * 30 * D;
  else if (/ימים|יום/.test(t)) ms = n * D;
  return ms == null ? null : new Date(now - ms).toISOString();
}

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// Drushim — https://www.drushim.co.il/jobs/search/{term}/
// ---------------------------------------------------------------------------

interface DrushimCard {
  id: string;
  path: string;
  title: string;
  company: string;
  meta: string[]; // [location, experience, type, …, "לפני X שעות"]
  snippet: string;
}

function parseDrushimCards(html: string): DrushimCard[] {
  const cards: DrushimCard[] = [];
  for (const chunk of html.split(/<article /).slice(1)) {
    const body = chunk.split("</article>")[0].replace(/<svg[\s\S]*?<\/svg>/g, "");
    const link = body.match(/href="(\/job\/(\d+)\/[\w]+\/)"/);
    if (!link) continue;
    // First element whose CSS-module class ends with __{cls} and has text (wrappers like __titleRow are skipped).
    const field = (cls: string) =>
      [...body.matchAll(new RegExp(`class="[^"]*__${cls}(?:\\s[^"]*)?"[^>]*>([^<]+)<`, "g"))].map((m) => m[1]).find((t) => t.trim());
    const meta = [...body.matchAll(/class="[^"]*job-card-meta[^"]*__text[^"]*"[^>]*>([^<]*)</g)].map((m) => decode(m[1]));
    cards.push({
      id: link[2],
      path: link[1],
      title: decode(field("title") ?? ""),
      company: decode(field("companyName") ?? ""),
      meta,
      snippet: decode(field("description") ?? ""),
    });
  }
  return cards.filter((c) => c.title);
}

async function drushimDetails(path: string): Promise<{ description: string; datePosted: string | null; city: string | null } | null> {
  try {
    const html = await getHtml(`https://www.drushim.co.il${path}`);
    for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      const ld = JSON.parse(m[1]);
      if (ld["@type"] !== "JobPosting") continue;
      const loc = Array.isArray(ld.jobLocation) ? ld.jobLocation[0] : ld.jobLocation;
      return {
        description: htmlToText(String(ld.description ?? "")),
        datePosted: ld.datePosted ? new Date(ld.datePosted).toISOString() : null,
        city: loc?.address?.addressLocality ?? null,
      };
    }
  } catch {}
  return null;
}

export async function fetchDrushim(term: string, opts: { known?: Set<string> } = {}): Promise<RawJob[]> {
  const html = await getHtml(`https://www.drushim.co.il/jobs/search/${encodeURIComponent(term)}/`);
  const cards = parseDrushimCards(html);
  // Full text only for jobs we haven't stored yet (keeps requests low).
  const details = await pool(cards, 3, (c) => (opts.known?.has(`drushim:${c.id}`) ? Promise.resolve(null) : drushimDetails(c.path)));
  return cards.map((c, i) => {
    const d = details[i];
    const ago = c.meta.find((m) => /לפני|היום|אתמול/.test(m));
    const location = d?.city ?? c.meta[0] ?? null;
    const description = d?.description || c.snippet;
    const url = `https://www.drushim.co.il${c.path}`;
    return {
      source: "drushim",
      externalId: c.id,
      url,
      title: c.title,
      company: c.company || "לא צוין",
      companyHidden: !c.company || /חסוי|חברה מובילה|לקוח/.test(c.company),
      location,
      remote: detectRemote(`${c.meta.join(" ")} ${description.slice(0, 3000)}`),
      description,
      applyEmail: extractEmail(description),
      applyUrl: url,
      postedAt: d?.datePosted ?? parseHebrewAgo(ago),
    } satisfies RawJob;
  });
}

// ---------------------------------------------------------------------------
// AllJobs — https://www.alljobs.co.il/SearchResultsGuest.aspx?freetxt={term}
// ---------------------------------------------------------------------------

export function parseAllJobs(html: string): RawJob[] {
  const jobs: RawJob[] = [];
  for (const box of html.split('<div class="job-content-top">').slice(1)) {
    const body = box.split(/<div class="job-content-bottom/)[0];
    const id = body.match(/UploadSingle\.aspx\?JobID=(\d+)/)?.[1];
    const title = decode(body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "");
    if (!id || !title) continue;
    const company = decode(body.match(/href="\/Employer\/HP\/Default\.aspx\?cid=\d+"[^>]*>([^<]+)<\/a>/)?.[1] ?? "");
    const staffing = /חברת השמה|כח אדם|כוח אדם/.test(body);
    const date = decode(body.match(/class="job-content-top-date"[^>]*>([^<]*)</)?.[1] ?? "");

    const bodyStart = body.indexOf("job-body-content");
    const text = htmlToText(bodyStart >= 0 ? body.slice(body.indexOf(">", bodyStart) + 1) : body);
    // First line is "Location: …" / "מיקום: …"; multi-city posts list the cities in a pop-up box.
    const cities = [...body.matchAll(/job-regions-content[\s\S]*?<\/div><\/div><\/div>/g)]
      .flatMap((m) => [...m[0].matchAll(/>([^<>]{2,40})<\/a>/g)].map((c) => c[1].trim()));
    const locLine = text.match(/(?:Location|מיקום(?: המשרה)?)\s*:\s*([^\n]+)/)?.[1]?.trim() ?? null;
    const location = cities.length ? cities.join(" / ") : locLine;
    const description = text.replace(/^[\s\S]*?(?:Job Role|תפקיד)\s*:\s*/i, "").trim() || text;
    const url = `https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=${id}`;

    jobs.push({
      source: "alljobs",
      externalId: id,
      url,
      title,
      company: company || "לא צוין",
      companyHidden: staffing,
      location,
      remote: detectRemote(`${location ?? ""} ${text.slice(0, 3000)}`),
      description,
      applyEmail: extractEmail(description),
      applyUrl: url,
      postedAt: parseHebrewAgo(/\d|היום|אתמול/.test(date) ? date : null),
    });
  }
  return jobs;
}

export async function fetchAllJobs(term: string): Promise<RawJob[]> {
  const html = await getHtml(
    `https://www.alljobs.co.il/SearchResultsGuest.aspx?page=1&position=&type=&freetxt=${encodeURIComponent(term)}&city=&region=`,
  );
  return parseAllJobs(html);
}

// ---------------------------------------------------------------------------

/** Search terms per role track (English + Hebrew, as Israeli posts use both). */
export const TRACK_SEARCH_TERMS: Record<string, string[]> = {
  "Data Analyst": ["data analyst", "דאטה אנליסט"],
  "BI Developer": ["BI developer", "מפתח BI"],
  "Data Engineer": ["data engineer"],
  "Product Analyst": ["product analyst"],
  "AI & Data": ["AI data analyst", "data scientist"],
};

export function searchTermsFor(tracks: string[]): string[] {
  return [...new Set(tracks.flatMap((t) => TRACK_SEARCH_TERMS[t] ?? []))];
}
