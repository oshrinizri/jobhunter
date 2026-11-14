"use client";

import { useState, useTransition } from "react";
import { translateJob } from "@/app/actions";

const cacheKey = (id: string) => `jh:tr:${id}`;

/** Job description with a "translate to Hebrew" toggle for English postings. Translation is cached per browser tab session. */
export function JobDescription({ jobId, text, isEnglish }: { jobId: string; text: string; isEnglish: boolean }) {
  // Cached translation only changes what shows after a click, so server and client first render match.
  const [translated, setTranslated] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : sessionStorage.getItem(cacheKey(jobId));
    } catch {
      return null;
    }
  });
  const [showHe, setShowHe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const translate = () => {
    if (translated) return setShowHe(true);
    setError(null);
    start(async () => {
      const r = await translateJob(jobId);
      if (r.text) {
        setTranslated(r.text);
        setShowHe(true);
        try {
          sessionStorage.setItem(cacheKey(jobId), r.text);
        } catch {}
      } else setError(r.error ?? "התרגום נכשל");
    });
  };

  const showing = showHe && translated ? translated : text;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">תיאור המשרה</h2>
        {isEnglish && text && (
          <button onClick={showHe ? () => setShowHe(false) : translate} disabled={pending} className="text-sm text-accent disabled:opacity-60">
            {pending ? "מתרגם… (כ-15 שניות)" : showHe ? "הצג מקור באנגלית" : "🌐 תרגום לעברית"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className={`whitespace-pre-line text-sm leading-relaxed ${isEnglish && !showHe ? "ltr text-start" : ""}`}>
        {showing || "אין תיאור."}
      </div>
    </div>
  );
}
