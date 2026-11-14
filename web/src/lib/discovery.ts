// AI company discovery: suggest employers that fit the profile, find their job boards,
// and store them as "suggested" for the user to approve or reject on the companies screen.

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ai, MODEL_WRITING } from "./ai";
import { resolveBoard, type ResolvedBoard } from "./connectors/ats";
import { fetchPublicHtml } from "./net";
import { commuteFor, loadUserContext } from "./pipeline";
import { bestCommute } from "./scoring/commute";
import { supabaseAdmin } from "./supabase/admin";
import { normalizeCompanyName } from "./text";

const Suggestion = z.object({
  name: z.string().describe("Official company name as used in Israel, in English if it has one"),
  name_he: z.string().nullable().describe("Hebrew name if commonly used"),
  website: z.string().nullable().describe("Main website domain, e.g. leumi.co.il"),
  careers_url: z.string().nullable().describe("Careers / jobs page URL if known"),
  sector: z.string().describe("Short sector label in Hebrew, e.g. בנקאות, ביטוח, פינטק, בריאות"),
  city: z.string().describe("City of the main Israeli office, in Hebrew"),
  quick_tier: z.enum(["A", "B", "C"]).describe("Stability estimate from general knowledge: A very stable, B stable, C risk"),
  hebrew_env: z.boolean().describe("Day-to-day work in Hebrew at the Israeli office"),
  why_he: z.string().describe("One short sentence in Hebrew: why this company fits the candidate"),
});
const SuggestionList = z.object({ companies: z.array(Suggestion) });
export type CompanySuggestion = z.infer<typeof Suggestion>;

const SYSTEM = `You help an Israeli job seeker build a list of employers to follow.
Suggest REAL companies that have an office in Israel, hire data people (Data Analyst, BI, Data Engineer, Product Analyst),
and fit the candidate's profile and preferences. Prefer direct employers — never staffing, placement or outsourcing firms.
Only suggest companies within a reasonable commute of the candidate's home (central Israel: Tel Aviv, Ramat Gan / Bnei Brak,
Petah Tikva, Rosh HaAyin, Airport City, Or Yehuda, Holon, Rishon LeZion, Herzliya, Ra'anana, Kfar Saba, Lod, Rehovot).
Aim for a mix: about 40% established Hebrew-speaking organizations (banks, insurance, credit cards, investment houses,
HMOs and hospitals, retail, telecom, government-owned companies), about 40% Israeli tech companies with data teams and a
Hebrew-speaking environment, and about 20% in the candidate's preferred domains.
The "city" must be the office where data roles actually sit; skip companies whose data teams are outside central Israel.
Never suggest companies from the exclusion list. Do not invent websites — use null when unsure.`;

/** Ask the AI for fitting companies, excluding everything the user already has (any status). */
export async function suggestCompanies(opts: {
  profileText: string;
  homeAddress: string;
  roleTracks: string[];
  preferredDomains: string[];
  notes: string;
  exclude: string[];
  count: number;
}): Promise<CompanySuggestion[]> {
  const res = await ai().messages.parse({
    model: MODEL_WRITING,
    max_tokens: 12000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(SuggestionList) },
    messages: [
      {
        role: "user",
        content: [
          `Suggest ${opts.count} companies.`,
          `Home: ${opts.homeAddress}. Target roles: ${opts.roleTracks.join(", ")}.`,
          `Preferred domains: ${opts.preferredDomains.join(", ") || "none"}. Prefers Hebrew work environment and direct employment.`,
          opts.notes ? `Candidate notes: ${opts.notes}` : "",
          `Exclusion list (already known or rejected): ${opts.exclude.join("; ") || "none"}`,
          `Candidate profile:\n${opts.profileText}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  });
  return res.parsed_output?.companies ?? [];
}

/** Run a small async task pool. */
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

export interface DiscoveryResult {
  added: number;
  scannable: number;
}

/**
 * Suggest new companies for a user, resolve their job boards, and store them as "suggested".
 * `db` can be the user's own client (RLS) or the service-role client.
 */
export async function discoverCompanies(db: SupabaseClient, userId: string, count = 20): Promise<DiscoveryResult> {
  const ctx = await loadUserContext(db, userId);
  const { data: existing } = await db.from("companies").select("name").eq("user_id", userId);
  const known = new Set((existing ?? []).map((c) => normalizeCompanyName(c.name)));
  for (const b of ctx.blacklist) known.add(normalizeCompanyName(b));

  const suggestions = await suggestCompanies({
    profileText: ctx.profileText,
    homeAddress: ctx.prefs.home_address,
    roleTracks: ctx.prefs.role_tracks,
    preferredDomains: ctx.prefs.preferred_domains,
    notes: ctx.prefs.preference_notes,
    exclude: [...new Set([...(existing ?? []).map((c) => c.name), ...ctx.blacklist])],
    count,
  });

  const unique = suggestions.filter((s) => {
    const key = normalizeCompanyName(s.name);
    if (known.has(key) || ctx.blacklist.some((b) => key.includes(normalizeCompanyName(b)))) return false;
    known.add(key);
    return true;
  });

  // Drop companies whose office is beyond the commute limit (+15 min slack, as for hybrid jobs).
  // Commute is cached per city, so this costs a Maps call only for new cities.
  const cacheDb = supabaseAdmin();
  const commutes = await pool(unique, 5, (s) =>
    commuteFor(cacheDb, ctx.prefs.home_address, s.city).catch(() => ({ driveMin: null, transitMin: null })),
  );
  const fresh = unique.filter((_, i) => {
    const best = bestCommute(commutes[i]);
    return best == null || best <= ctx.prefs.max_commute_min + 15;
  });

  const boards = await pool(fresh, 5, (s) =>
    resolveBoard({ name: s.name, website: s.website, careersUrl: s.careers_url, fetchHtml: (u) => fetchPublicHtml(u, 12_000) }).catch(
      () => null as ResolvedBoard | null,
    ),
  );

  const rows = fresh.map((s, i) => ({
    user_id: userId,
    name: s.name,
    website: s.website,
    ats: boards[i]?.ats ?? "none",
    ats_board: boards[i]?.board ?? null,
    ats_token: boards[i]?.token ?? null,
    status: "suggested",
    source: "ai",
    suggest_reason: s.why_he,
    suggest_meta: {
      name_he: s.name_he,
      sector: s.sector,
      city: s.city,
      quick_tier: s.quick_tier,
      hebrew_env: s.hebrew_env,
      careers_url: s.careers_url,
      board_jobs: boards[i]?.count ?? null,
    },
  }));
  if (rows.length) {
    const { error } = await db.from("companies").upsert(rows, { onConflict: "user_id,name", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return { added: rows.length, scannable: boards.filter(Boolean).length };
}
