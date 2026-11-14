// Fetching public web pages safely (never internal / private addresses).

export const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1|0\.)/i;

export function assertPublicUrl(url: string): URL {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || PRIVATE_HOST.test(u.hostname)) throw new Error("כתובת לא נתמכת");
  return u;
}

/** GET a public page's HTML. Throws on private hosts and non-2xx responses. */
export async function fetchPublicHtml(url: string, timeoutMs = 20_000): Promise<string> {
  assertPublicUrl(url);
  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, "Accept-Language": "he,en" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`הדף לא נטען (${res.status})`);
  // A redirect could land on a private address — re-check the final URL.
  if (res.url) assertPublicUrl(res.url);
  return res.text();
}
