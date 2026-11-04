"use client";

import { useActionState, useState } from "react";
import { saveSettings, type SettingsState } from "./actions";
import { Card } from "@/components/ui";
import type { Preferences, Weights } from "@/lib/types";

const WEIGHT_LABELS: Record<keyof Weights, string> = {
  skills: "התאמת כישורים",
  role: "תפקיד ורמה",
  commute: "נסיעה",
  stability: "יציבות חברה",
  salary: "שכר",
  domain: "תחום",
  hebrew: "סביבה עברית",
};

const TRACKS = ["Data Analyst", "BI Developer", "Data Engineer", "Product Analyst"];

const input = "w-full rounded-xl border border-border bg-surface px-3 py-2";

export function SettingsForm({ prefs }: { prefs: Preferences }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, null);
  const [weights, setWeights] = useState<Weights>(prefs.weights);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  return (
    <form action={action} className="space-y-4">
      <Card className="space-y-3">
        <h2 className="font-semibold">מיקום ושכר</h2>
        <label className="block text-sm">
          <span className="text-muted">כתובת מגורים (לחישוב נסיעה)</span>
          <input name="home_address" defaultValue={prefs.home_address} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-muted">זמן נסיעה מקסימלי (דקות)</span>
            <input name="max_commute_min" type="number" min={10} max={120} defaultValue={prefs.max_commute_min} className={input} />
          </label>
          <label className="block text-sm">
            <span className="text-muted">שכר יעד (₪ ברוטו)</span>
            <input name="target_salary" type="number" step={500} defaultValue={prefs.target_salary} className={input} />
          </label>
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">כיווני תפקיד</h2>
        <div className="flex flex-wrap gap-2">
          {TRACKS.map((t) => (
            <label key={t} className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm">
              <input type="checkbox" name="role_tracks" value={t} defaultChecked={prefs.role_tracks.includes(t)} />
              <span className="ltr">{t}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">משקלות הציון</h2>
          <span className="text-xs text-muted">סה״כ {total} (מנורמל אוטומטית)</span>
        </div>
        {(Object.keys(WEIGHT_LABELS) as (keyof Weights)[]).map((k) => (
          <label key={k} className="block">
            <div className="flex justify-between text-sm">
              <span>{WEIGHT_LABELS[k]}</span>
              <span className="tabular-nums text-muted">{total ? Math.round((weights[k] / total) * 100) : 0}%</span>
            </div>
            <input
              type="range"
              name={`w_${k}`}
              min={0}
              max={50}
              value={weights[k]}
              onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </label>
        ))}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">העדפות נוספות</h2>
        <label className="block text-sm">
          <span className="text-muted">תחומים מועדפים (מופרדים בפסיק)</span>
          <input name="preferred_domains" defaultValue={prefs.preferred_domains.join(", ")} className={input} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">מילים שפוסלות משרה לפי הכותרת</span>
          <input name="negative_keywords" defaultValue={prefs.negative_keywords.join(", ")} className={input} />
        </label>
        <label className="block text-sm">
          <span className="text-muted">הערות העדפה (נשלחות ל-AI בכל דירוג)</span>
          <textarea name="preference_notes" rows={3} defaultValue={prefs.preference_notes} className={input} />
        </label>
      </Card>

      <button disabled={pending} className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
        {pending ? "שומר ומדרג מחדש…" : "שמירה"}
      </button>
      {state?.ok && <p className="text-center text-sm text-good">{state.ok}</p>}
      {state?.error && <p className="text-center text-sm text-bad">{state.error}</p>}
    </form>
  );
}
