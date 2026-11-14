"use client";

import { useActionState, useState } from "react";
import { tailorCv, type TailorState } from "./actions";

export function TailorButton({ jobId, lang, hasVersion }: { jobId: string; lang: "he" | "en"; hasVersion: boolean }) {
  const [state, action, pending] = useActionState<TailorState, FormData>(() => tailorCv(jobId, lang), null);
  return (
    <form action={action} className="space-y-1">
      <button
        disabled={pending}
        className={`w-full rounded-xl py-2.5 font-semibold disabled:opacity-60 ${hasVersion ? "border border-border text-muted" : "bg-accent text-white"}`}
      >
        {pending
          ? "מתאים את קורות החיים למשרה… (כחצי דקה)"
          : hasVersion
            ? `↻ גרסה חדשה (${lang === "he" ? "עברית" : "English"})`
            : `✨ התאמת קורות חיים למשרה (${lang === "he" ? "עברית" : "English"})`}
      </button>
      {state?.error && <p className="text-sm text-bad">{state.error}</p>}
    </form>
  );
}

export function CopyBox({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{label}</h2>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="text-sm text-accent"
        >
          {copied ? "✓ הועתק" : "העתקה"}
        </button>
      </div>
      <p dir="auto" className="whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm">
        {text}
      </p>
    </div>
  );
}
