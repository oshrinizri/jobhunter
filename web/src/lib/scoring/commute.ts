// Commute times from home → job via Google Maps Routes API (drive at morning rush + public transit).
// Results are cached per (origin, destination) in commute_cache, so each city is computed once.

import type { Commute } from "../types";

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

/** Next weekday (Sun–Thu, Israel) at 08:00 local time, as RFC3339. */
function nextMorningRush(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 5 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1); // skip Fri/Sat
  d.setUTCHours(5, 0, 0, 0); // 08:00 Israel ≈ 05:00/06:00 UTC; 05:00 is a safe rush-hour proxy
  return d.toISOString();
}

async function route(origin: string, destination: string, mode: "DRIVE" | "TRANSIT"): Promise<number | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const body: Record<string, unknown> = {
    origin: { address: origin },
    destination: { address: destination },
    travelMode: mode,
    departureTime: nextMorningRush(),
    languageCode: "he",
    regionCode: "IL",
  };
  if (mode === "DRIVE") body.routingPreference = "TRAFFIC_AWARE";
  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.duration",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Routes API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { routes?: { duration?: string }[] };
  const dur = data.routes?.[0]?.duration; // e.g. "1834s"
  return dur ? Math.round(parseInt(dur, 10) / 60) : null;
}

export async function computeCommute(origin: string, destination: string): Promise<Commute> {
  const warn = (mode: string) => (e: unknown) => {
    console.warn(`commute ${mode} failed (${destination}):`, e instanceof Error ? e.message.slice(0, 200) : e);
    return null;
  };
  const [driveMin, transitMin] = await Promise.all([
    route(origin, destination, "DRIVE").catch(warn("drive")),
    route(origin, destination, "TRANSIT").catch(warn("transit")),
  ]);
  return { driveMin, transitMin };
}

/** Best (shortest) of the two modes — spec: a job passes if either mode is within the limit. */
export function bestCommute(c: Commute): number | null {
  const vals = [c.driveMin, c.transitMin].filter((v): v is number => v != null);
  return vals.length ? Math.min(...vals) : null;
}

/** Commute sub-score (0–100). */
export function commuteScore(c: Commute, remote: string, maxMin: number): number {
  if (remote === "remote") return 100;
  const best = bestCommute(c);
  if (best == null) return 60; // unknown → neutral
  const limit = remote === "hybrid" ? maxMin + 15 : maxMin;
  if (best > limit) return 0;
  // 15 min or less → 100, at the limit → 40, linear in between
  const s = best <= 15 ? 100 : 100 - ((best - 15) / Math.max(1, limit - 15)) * 60;
  return Math.round(Math.min(100, s + (remote === "hybrid" ? 15 : 0)));
}

/** Clean an ATS location string into something Routes can geocode. */
export function destinationFor(location: string | null): string | null {
  if (!location) return null;
  const first = location.split(/\s*\/\s*|;/)[0];
  const cleaned = first.replace(/\b(District|Tel Aviv District|Center District|Central District)\b/gi, "").replace(/\s*,\s*,/g, ",");
  return /israel|ישראל/i.test(cleaned) ? cleaned : `${cleaned}, Israel`;
}
