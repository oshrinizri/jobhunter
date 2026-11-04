// Text helpers shared by connectors and the pipeline.

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/** HTML (possibly entity-escaped) → readable plain text. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  let s = html;
  // Greenhouse double-escapes HTML; decode once if it looks escaped.
  if (/&lt;\w/.test(s)) s = decodeEntities(s);
  s = s
    .replace(/<\s*(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export function extractEmail(text: string): string | null {
  const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : null;
}

export function detectLanguage(text: string): "he" | "en" {
  const he = (text.match(/[֐-׿]/g) ?? []).length;
  const en = (text.match(/[A-Za-z]/g) ?? []).length;
  return he > en * 0.3 ? "he" : "en";
}

/** Normalized key used to merge the same job seen on several sources. */
export function jobFingerprint(company: string, title: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\b(ltd|inc|בע"מ|בעמ|limited|israel|ישראל)\b/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return `${norm(company)}|${norm(title)}`;
}

export function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Is a free-text location inside Israel? (connectors return global jobs) */
export function isIsraelLocation(loc: string | null | undefined): boolean {
  if (!loc) return false;
  return /israel|ישראל|tel[ -]?aviv|ת"א|תל אביב|herzliya|הרצליה|petah|פתח תקו|ramat gan|רמת גן|jerusalem|ירושלים|haifa|חיפה|ra'?anana|רעננה|netanya|נתניה|rehovot|רחובות|hod hasharon|הוד השרון|kfar saba|כפר סבא|or yehuda|אור יהודה|kiryat ono|קרית אונו|קריית אונו|givatayim|גבעתיים|bnei brak|בני ברק|holon|חולון|rishon|ראשון|airport city|yokneam|יקנעם|caesarea|קיסריה|modiin|מודיעין|be'?er sheva|באר שבע|rosh ha'?ayin|ראש העין|lod|לוד|ramla|רמלה|yehud|יהוד/i.test(
    loc,
  );
}

export function detectRemote(text: string): "onsite" | "hybrid" | "remote" | "unknown" {
  if (/hybrid|היברידי/i.test(text)) return "hybrid";
  if (/\bremote\b|work from home|מהבית/i.test(text)) return "remote";
  if (/on[- ]?site|מהמשרד/i.test(text)) return "onsite";
  return "unknown";
}
