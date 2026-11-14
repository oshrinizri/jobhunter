"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addCompany,
  approveSuggestion,
  rateCompany,
  rejectSuggestion,
  setCompanyStatus,
  setTierOverride,
  suggestMore,
  type CompanyFormState,
} from "./actions";
import type { CompanyCard } from "@/lib/types";

const TIER_TONE: Record<string, string> = {
  A: "bg-good-soft text-good",
  B: "bg-mid-soft text-mid",
  C: "bg-bad-soft text-bad",
};
const TIER_LABEL: Record<string, string> = { A: "יציבה מאוד", B: "יציבה", C: "בסיכון" };
const LANG_LABEL: Record<string, string> = { he: "עברית", en: "אנגלית", mixed: "עברית ואנגלית" };

function TierBadge({ tier, title }: { tier: string | null; title?: string }) {
  return (
    <div
      title={title}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${tier ? TIER_TONE[tier] : "bg-surface-2 text-muted"}`}
    >
      {tier ?? "?"}
    </div>
  );
}

export function AddCompanyForm() {
  const [state, action, pending] = useActionState<CompanyFormState, FormData>(addCompany, null);
  const [showUrl, setShowUrl] = useState(false);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="name" placeholder="שם חברה להוספה" className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5" />
        <button disabled={pending} className="rounded-xl bg-accent px-4 font-semibold text-white disabled:opacity-60">
          {pending ? "בודק ומדרג…" : "הוספה"}
        </button>
      </div>
      {showUrl ? (
        <input
          name="careers_url"
          dir="ltr"
          placeholder="https://… כתובת עמוד הקריירה (לא חובה)"
          className="w-full rounded-xl border border-border bg-surface px-4 py-2 text-sm"
        />
      ) : (
        <button type="button" onClick={() => setShowUrl(true)} className="text-xs text-muted hover:underline">
          + יש לי כתובת של עמוד הקריירה
        </button>
      )}
      {pending && <p className="text-xs text-muted">מחפש לוח משרות ובונה כרטיס חברה. זה לוקח עד חצי דקה.</p>}
      {state?.ok && <p className="text-sm text-good">{state.ok}</p>}
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}

export function SuggestButton() {
  const [state, action, pending] = useActionState<CompanyFormState, FormData>(() => suggestMore(), null);
  return (
    <form action={action} className="space-y-2">
      <button
        disabled={pending}
        className="w-full rounded-xl border border-accent bg-accent-soft py-2.5 font-semibold text-accent disabled:opacity-60"
      >
        {pending ? "מחפש חברות מתאימות… (כדקה)" : "✨ הצע לי חברות מתאימות"}
      </button>
      {state?.ok && <p className="text-sm text-good">{state.ok}</p>}
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}

interface Company {
  id: string;
  name: string;
  ats: string | null;
  status: string;
  tier_override: "A" | "B" | "C" | null;
  last_fetch_count: number | null;
  last_fetch_error: string | null;
  suggest_reason?: string | null;
  suggest_meta?: {
    name_he?: string | null;
    sector?: string;
    city?: string;
    quick_tier?: "A" | "B" | "C";
    hebrew_env?: boolean;
    board_jobs?: number | null;
  } | null;
}

export function SuggestionRow({ company: c }: { company: Company }) {
  const [pending, start] = useTransition();
  const m = c.suggest_meta ?? {};
  const scannable = c.ats && c.ats !== "none";
  return (
    <div className={`space-y-2 px-4 py-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <TierBadge tier={m.quick_tier ?? null} title="הערכת יציבות ראשונית" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            <span className="ltr">{c.name}</span>
            {m.name_he && m.name_he !== c.name ? <span className="text-muted"> · {m.name_he}</span> : null}
          </p>
          <p className="text-xs text-muted">
            {[m.sector, m.city, m.hebrew_env ? "סביבה עברית" : null].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 text-xs">{scannable ? "🔎 יש לוח משרות. החברה תיסרק אוטומטית" : "ללא לוח משרות לסריקה. משרות שלה יגיעו דרך LinkedIn"}</p>
        </div>
      </div>
      {c.suggest_reason && <p className="text-sm">{c.suggest_reason}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => start(() => approveSuggestion(c.id))}
          className="flex-1 rounded-lg bg-accent py-1.5 text-sm font-semibold text-white"
        >
          {pending ? "מוסיף ומדרג…" : "✓ הוספה"}
        </button>
        <button onClick={() => start(() => rejectSuggestion(c.id))} className="flex-1 rounded-lg border border-border py-1.5 text-sm text-muted">
          ✕ לא מתאים
        </button>
      </div>
    </div>
  );
}

export function CompanyRow({ company: c, card }: { company: Company; card: CompanyCard | null }) {
  const [pending, start] = useTransition();
  const tier = c.tier_override ?? card?.tier ?? null;
  const facts = card
    ? [
        card.sector,
        card.employees ? `${card.employees.toLocaleString("he-IL")} עובדים` : null,
        card.work_language ? LANG_LABEL[card.work_language] : null,
        card.is_public ? "ציבורית" : null,
        card.recent_layoffs ? "⚠️ פיטורים בשנה האחרונה" : null,
        card.is_staffing ? "🏷️ חברת השמה" : null,
      ].filter(Boolean)
    : [];

  return (
    <div className={`px-4 py-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <TierBadge tier={tier} title={tier ? TIER_LABEL[tier] : "לא דורגה"} />
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate text-right font-medium">{c.name}</p>
          <p className="truncate text-xs text-muted">
            {c.ats && c.ats !== "none" ? `${c.ats} · ${c.last_fetch_count ?? 0} משרות בישראל` : "ללא לוח משרות"}
            {c.last_fetch_error ? " · ⚠️ שגיאת סריקה" : ""}
          </p>
        </div>
        <select
          aria-label="דרגת יציבות"
          value={c.tier_override ?? ""}
          onChange={(e) => start(() => setTierOverride(c.id, (e.target.value || null) as Company["tier_override"]))}
          className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
        >
          <option value="">{card?.tier ? `${card.tier} (AI)` : "דרגה"}</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
        {c.status === "blacklist" ? (
          <button onClick={() => start(() => setCompanyStatus(c.id, "active"))} className="text-sm text-accent">
            שחזור
          </button>
        ) : (
          <button onClick={() => start(() => setCompanyStatus(c.id, "blacklist"))} className="text-sm text-bad" aria-label="העברה לרשימה שחורה">
            🚫
          </button>
        )}
      </div>

      {c.status !== "blacklist" &&
        (card ? (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-xs text-muted">{facts.join(" · ") || "פרטי החברה"}</summary>
            {card.summary && <p className="mt-1">{card.summary}</p>}
            <button onClick={() => start(() => rateCompany(c.name))} className="mt-1 text-xs text-accent">
              {pending ? "מדרג…" : "דירוג מחדש"}
            </button>
          </details>
        ) : (
          <button onClick={() => start(() => rateCompany(c.name))} className="mt-2 text-xs text-accent">
            {pending ? "חוקר את החברה… (עד חצי דקה)" : "דרג את החברה (יציבות, גודל, שפת עבודה)"}
          </button>
        ))}
    </div>
  );
}
