"use client";

import { useActionState, useTransition } from "react";
import { addCompany, setCompanyStatus, setTierOverride, type CompanyFormState } from "./actions";

export function AddCompanyForm() {
  const [state, action, pending] = useActionState<CompanyFormState, FormData>(addCompany, null);
  return (
    <form action={action} className="space-y-2">
      <div className="flex gap-2">
        <input name="name" placeholder="שם חברה להוספה" className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5" />
        <button disabled={pending} className="rounded-xl bg-accent px-4 font-semibold text-white disabled:opacity-60">
          {pending ? "בודק…" : "הוספה"}
        </button>
      </div>
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
}

export function CompanyRow({ company: c, aiTier }: { company: Company; aiTier: string | null }) {
  const [pending, start] = useTransition();
  const tier = c.tier_override ?? aiTier;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${pending ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">
        <p dir="auto" className="truncate text-right font-medium">{c.name}</p>
        <p className="text-xs text-muted">
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
        <option value="">{tier ? `${tier} (AI)` : "דרגה"}</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
      </select>
      {c.status === "blacklist" ? (
        <button onClick={() => start(() => setCompanyStatus(c.id, "active"))} className="text-sm text-accent">שחזור</button>
      ) : (
        <button onClick={() => start(() => setCompanyStatus(c.id, "blacklist"))} className="text-sm text-bad" aria-label="העברה לרשימה שחורה">
          🚫
        </button>
      )}
    </div>
  );
}
