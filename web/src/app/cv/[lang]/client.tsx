"use client";

import { useActionState, useState } from "react";
import { generateCv, saveContact, type CvState } from "./actions";
import type { CvContact } from "@/lib/cv";

const input = "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm";

export function GenerateButton({ lang, hasCv }: { lang: "he" | "en"; hasCv: boolean }) {
  const [state, action, pending] = useActionState<CvState, FormData>(() => generateCv(lang), null);
  return (
    <form action={action} className="space-y-1">
      <button
        disabled={pending}
        className={`w-full rounded-xl py-2.5 font-semibold disabled:opacity-60 ${hasCv ? "border border-border text-muted" : "bg-accent text-white"}`}
      >
        {pending ? "כותב קורות חיים מהפרופיל… (כחצי דקה)" : hasCv ? "↻ ליצור מחדש מהפרופיל המעודכן" : "✨ ליצור קורות חיים מהפרופיל"}
      </button>
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="w-full rounded-xl bg-accent py-2.5 font-semibold text-white">
      ⬇ שמירה כ-PDF
    </button>
  );
}

export function ContactForm({ contact }: { contact: CvContact }) {
  const [open, setOpen] = useState(!contact.phone);
  const [state, action, pending] = useActionState<CvState, FormData>(saveContact, null);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-accent">
        עריכת פרטי קשר
      </button>
    );
  const f = (name: keyof CvContact, label: string, dir: "ltr" | "auto" = "auto") => (
    <label className="block text-xs text-muted">
      {label}
      <input name={name} defaultValue={contact[name]} dir={dir} className={input} />
    </label>
  );
  return (
    <form action={action} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold">פרטי קשר בראש קורות החיים</p>
      <div className="grid grid-cols-2 gap-2">
        {f("name", "שם מלא")}
        {f("headline", "כותרת (ריק = של ה-AI)")}
        {f("phone", "טלפון", "ltr")}
        {f("email", "מייל", "ltr")}
        {f("city", "עיר")}
        {f("linkedin", "LinkedIn (לא חובה)", "ltr")}
      </div>
      <button disabled={pending} className="w-full rounded-lg bg-accent py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "שומר…" : "שמירת פרטי קשר"}
      </button>
      {state?.ok && <p className="text-sm text-good">{state.ok}</p>}
    </form>
  );
}
