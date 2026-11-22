"use client";

import { useActionState, useState } from "react";
import { saveSettings, type SettingsState } from "./actions";
import { Card } from "@/components/ui";
import { ROLE_TRACKS } from "@/lib/scoring/filters";
import { SCAN_SLOTS, type Preferences, type Weights } from "@/lib/types";

const WEIGHT_LABELS: Record<keyof Weights, string> = {
  skills: "התאמת כישורים",
  role: "תפקיד ורמה",
  commute: "נסיעה",
  stability: "יציבות חברה",
  salary: "שכר",
  domain: "תחום",
  hebrew: "סביבה עברית",
};

const TRACKS = ROLE_TRACKS;

const input = "w-full rounded-xl border border-border bg-surface px-3 py-2";

const AGE_OPTIONS = [7, 14, 21, 30, 45, 60, 90];

const SLOT_LABELS: Record<number, string> = { 7: "07:00 בוקר", 12: "12:00 צהריים", 17: "17:00 אחה״צ", 21: "21:00 ערב" };
const DAY_LABELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const chip = "flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent";

function ScanSettings({ prefs }: { prefs: Preferences }) {
  const [enabled, setEnabled] = useState(prefs.scan_enabled);
  const [hours, setHours] = useState<number[]>(prefs.scan_hours);
  const [days, setDays] = useState<number[]>(prefs.scan_days);
  const toggle = (list: number[], v: number) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const perWeek = enabled ? hours.length * days.length : 0;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">סריקה אוטומטית</h2>
        <label className="flex items-center gap-2 text-sm">
          <span className={enabled ? "text-good" : "text-muted"}>{enabled ? "פעילה" : "מושהית"}</span>
          <input
            type="checkbox"
            name="scan_enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 accent-[var(--accent)]"
          />
        </label>
      </div>

      <fieldset disabled={!enabled} className="space-y-3 disabled:opacity-50">
        <div className="space-y-1.5">
          <p className="text-sm text-muted">שעות סריקה</p>
          <div className="flex flex-wrap gap-2">
            {SCAN_SLOTS.map((h) => (
              <label key={h} className={chip}>
                <input type="checkbox" name="scan_hours" value={h} checked={hours.includes(h)} onChange={() => setHours(toggle(hours, h))} className="sr-only" />
                {SLOT_LABELS[h]}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm text-muted">ימים</p>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((d, i) => (
              <label key={i} className={chip}>
                <input type="checkbox" name="scan_days" value={i} checked={days.includes(i)} onChange={() => setDays(toggle(days, i))} className="sr-only" />
                {d}
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="auto_company_research" defaultChecked={prefs.auto_company_research} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span>
            חקירת חברות חדשות אוטומטית
            <span className="block text-xs text-muted">
              ה-AI מחפש ברשת מידע על יציבות החברה. זה החלק היקר בסריקה. כשהאפשרות כבויה, חברה חדשה מקבלת ציון יציבות ניטרלי, ואפשר לדרג אותה ידנית במסך החברות.
            </span>
          </span>
        </label>
      </fieldset>

      <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
        {perWeek === 0
          ? "הסריקות מושהות: אין עלות AI. כל מה שכבר נאסף נשמר, ומסד הנתונים נשאר ער."
          : `${perWeek} סריקות בשבוע. העלות תלויה בכמות המשרות החדשות ולא במספר הסריקות. סריקות תכופות רק מוצאות אותן מוקדם יותר. החיסכון הגדול הוא בכיבוי חקירת החברות.`}
      </p>
    </Card>
  );
}

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

      <ScanSettings prefs={prefs} />

      <Card className="space-y-2">
        <h2 className="font-semibold">טריות משרות</h2>
        <label className="block text-sm">
          <span className="text-muted">להציג משרות שפורסמו עד</span>
          <select name="max_job_age_days" defaultValue={String(prefs.max_job_age_days)} className={input}>
            {AGE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} ימים אחרונים{d === 30 ? " (מומלץ)" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">
          משרות ישנות יותר מוסתרות ולא נשלחות לדירוג AI, וזה חוסך עלות. משרות שהוספת ידנית תמיד מוצגות. אחרי הגדלת הטווח, המשרות שנכנסו לטווח ידורגו בסריקה הבאה.
        </p>
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
