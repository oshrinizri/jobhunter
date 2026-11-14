"use client";

import { useActionState, useState, useTransition } from "react";
import { askQuestions, deleteItem, rescoreJobs, saveItem, skipQuestion, submitAnswers, type ActionState } from "./actions";
import { KIND_LABELS, PROFILE_KINDS, type ProfileItem, type ProfileKind } from "@/lib/profile-seed";

const input = "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm";
const month = (d?: string | null) => (d ? d.slice(0, 7) : "");

function period(i: ProfileItem) {
  if (!i.start_date) return "";
  return `${month(i.start_date)} – ${i.end_date ? month(i.end_date) : "היום"}`;
}

function ItemForm({ item, kind, onDone }: { item?: ProfileItem & { id: string }; kind: ProfileKind; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (p, f) => {
    const r = await saveItem(p, f);
    if (r?.ok) onDone();
    return r;
  }, null);
  const dated = ["role", "education", "course", "project", "military", "volunteer", "certification"].includes(kind);
  return (
    <form action={action} className="space-y-2 rounded-xl bg-surface-2 p-3">
      {item?.id && <input type="hidden" name="id" value={item.id} />}
      <select name="kind" defaultValue={kind} className={input}>
        {PROFILE_KINDS.map((k) => (
          <option key={k} value={k}>
            {KIND_LABELS[k]}
          </option>
        ))}
      </select>
      <input name="title" defaultValue={item?.title} placeholder="כותרת (תפקיד / כישור / קורס)" dir="auto" className={input} />
      <input name="org" defaultValue={item?.org ?? ""} placeholder="ארגון / מוסד (לא חובה)" dir="auto" className={input} />
      {dated && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            התחלה
            <input name="start_date" type="month" defaultValue={month(item?.start_date)} className={input} />
          </label>
          <label className="text-xs text-muted">
            סיום (ריק = היום)
            <input name="end_date" type="month" defaultValue={month(item?.end_date)} className={input} />
          </label>
        </div>
      )}
      <textarea name="details" rows={4} defaultValue={item?.details} placeholder="פירוט: מה עשית, כלים, תוצאות ומספרים" dir="auto" className={input} />
      <input name="tags" defaultValue={item?.tags?.join(", ")} placeholder="תגיות, מופרדות בפסיק (SQL, Python...)" dir="ltr" className={input} />
      <div className="flex gap-2">
        <button disabled={pending} className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "שומר…" : "שמירה"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-border px-4 text-sm text-muted">
          ביטול
        </button>
      </div>
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}

export function ProfileItemRow({ item }: { item: ProfileItem & { id: string } }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  if (editing) return <ItemForm item={item} kind={item.kind} onDone={() => setEditing(false)} />;
  return (
    <div className={`group px-4 py-3 ${pending ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p dir="auto" className="text-right font-medium">
            {item.title}
            {item.org ? <span className="font-normal text-muted"> · {item.org}</span> : null}
          </p>
          {period(item) && <p className="ltr text-right text-xs text-muted">{period(item)}</p>}
          {item.details && (
            <p dir="auto" className="mt-1 whitespace-pre-line text-right text-sm text-muted">
              {item.details}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2 text-sm">
          <button onClick={() => setEditing(true)} className="text-accent">
            עריכה
          </button>
          <button
            onClick={() => confirm("למחוק את הפריט?") && start(() => deleteItem(item.id))}
            className="text-bad"
            aria-label="מחיקה"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddItem() {
  const [open, setOpen] = useState(false);
  return open ? (
    <ItemForm kind="skill" onDone={() => setOpen(false)} />
  ) : (
    <button onClick={() => setOpen(true)} className="w-full rounded-xl border border-dashed border-border py-2.5 text-sm text-muted">
      + הוספת פריט לפרופיל
    </button>
  );
}

interface Question {
  id: string;
  question: string;
  why: string;
}

export function Interview({ questions }: { questions: Question[] }) {
  const [askState, ask, asking] = useActionState<ActionState, FormData>(() => askQuestions(), null);
  const [ansState, submit, submitting] = useActionState<ActionState, FormData>(submitAnswers, null);
  const [, start] = useTransition();

  return (
    <div className="space-y-3">
      {questions.length > 0 ? (
        <form action={submit} className="space-y-3">
          {questions.map((q, n) => (
            <div key={q.id} className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">
                  {n + 1}. {q.question}
                </p>
                <button type="button" onClick={() => start(() => skipQuestion(q.id))} className="shrink-0 text-xs text-muted">
                  דילוג
                </button>
              </div>
              {q.why && <p className="text-xs text-muted">{q.why}</p>}
              <textarea name={`a_${q.id}`} rows={2} dir="auto" className={input} placeholder="תשובה קצרה. אפשר גם 'לא'" />
            </div>
          ))}
          <button disabled={submitting} className="w-full rounded-xl bg-accent py-2.5 font-semibold text-white disabled:opacity-60">
            {submitting ? "מעדכן את הפרופיל…" : "שליחת התשובות ועדכון הפרופיל"}
          </button>
        </form>
      ) : (
        <form action={ask}>
          <button disabled={asking} className="w-full rounded-xl border border-accent bg-accent-soft py-2.5 font-semibold text-accent disabled:opacity-60">
            {asking ? "מכין שאלות…" : "✨ שאל אותי כמה שאלות לשיפור קורות החיים"}
          </button>
        </form>
      )}
      {askState?.error && <p className="text-sm text-bad">{askState.error}</p>}
      {ansState?.error && <p className="text-sm text-bad">{ansState.error}</p>}
      {ansState?.ok && (
        <div className="rounded-xl bg-good-soft p-3 text-sm text-good">
          <p className="font-semibold">{ansState.ok}</p>
          {ansState.lines?.length ? (
            <ul className="mt-1 list-inside list-disc">
              {ansState.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function RescoreButton() {
  const [state, action, pending] = useActionState<ActionState, FormData>(() => rescoreJobs(), null);
  return (
    <form action={action} className="space-y-1">
      <button disabled={pending} className="text-sm text-accent disabled:opacity-60">
        {pending ? "…" : "↻ לדרג מחדש את המשרות לפי הפרופיל המעודכן"}
      </button>
      {state?.ok && <p className="text-xs text-good">{state.ok}</p>}
    </form>
  );
}
