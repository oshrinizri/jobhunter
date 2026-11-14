// Small presentational pieces shared across screens.

export const TAG_LABELS: Record<string, string> = {
  risk: "⚠️ חברה בסיכון",
  contractor: "🏷️ דרך קבלן",
  hidden_company: "🕵️ חברה מוסתרת",
  english: "🌐 סביבה באנגלית",
  hybrid: "🏠 היברידי",
  new: "🆕 חדש",
  multi_source: "🔁 כמה מקורות",
};

export const FILTER_LABELS: Record<string, string> = {
  blacklist: "רשימה שחורה",
  keyword: "מילת מפתח שלילית",
  seniority: "רמה לא מתאימה",
  role: "תפקיד מחוץ לכיוונים",
  commute: "נסיעה ארוכה מדי",
};

export function scoreTone(score: number | null | undefined) {
  if (score == null) return "bg-surface-2 text-muted";
  if (score >= 80) return "bg-good-soft text-good";
  if (score >= 60) return "bg-mid-soft text-mid";
  return "bg-bad-soft text-bad";
}

export function ScoreBadge({ score, size = "md" }: { score: number | null | undefined; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "h-16 w-16 text-2xl" : "h-12 w-12 text-lg";
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-2xl font-bold tabular-nums ${dims} ${scoreTone(score)}`}>
      {score ?? "…"}
    </div>
  );
}

export function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "accent" | "bad" }) {
  const cls =
    tone === "accent" ? "bg-accent-soft text-accent" : tone === "bad" ? "bg-bad-soft text-bad" : "bg-surface-2 text-muted";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}

export function commuteText(transit: number | null, drive: number | null) {
  const parts: string[] = [];
  if (drive != null) parts.push(`🚗 ${drive} ד׳`);
  if (transit != null) parts.push(`🚌 ${transit} ד׳`);
  return parts.join(" · ");
}

export function timeAgo(iso: string | null) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days <= 0) return "היום";
  if (days === 1) return "אתמול";
  if (days < 30) return `לפני ${days} ימים`;
  const months = Math.floor(days / 30);
  if (months === 1) return "לפני חודש";
  if (months === 2) return "לפני חודשיים";
  return `לפני ${months} חודשים`;
}

/** "פורסם לפני 3 ימים", or "נמצא …" when the board gave no posting date. */
export function postedText(postedAt: string | null, firstSeenAt: string) {
  return postedAt ? `פורסם ${timeAgo(postedAt)}` : `נמצא ${timeAgo(firstSeenAt)}`;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-surface p-4 ${className}`}>{children}</div>;
}

export function EmptyState({ title, body }: { title: string; body?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {body && <div className="mt-1 text-sm text-muted">{body}</div>}
    </div>
  );
}
