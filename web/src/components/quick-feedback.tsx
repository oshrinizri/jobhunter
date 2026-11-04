"use client";

import { useState, useTransition } from "react";
import { sendFeedback } from "@/app/actions";

export const DOWN_REASONS = [
  "תפקיד לא מתאים",
  "רחוק",
  "חברה לא מעניינת",
  "דרישות גבוהות מדי",
  "נמוך מדי בשבילי",
  "אנגלית",
  "אחר",
];

/** 👍 / 👎 with reason chips — one tap on mobile. */
export function QuickFeedback({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<"up" | "down" | null>(null);
  const [pending, start] = useTransition();

  if (done) return <span className="text-xs text-muted">{done === "up" ? "👍 נרשם" : "👎 נרשם"}</span>;

  return (
    <div className="flex items-center gap-1">
      <button
        aria-label="מתאים"
        disabled={pending}
        onClick={() => start(async () => { await sendFeedback(jobId, "up"); setDone("up"); })}
        className="rounded-lg px-2 py-1 text-lg hover:bg-surface-2"
      >
        👍
      </button>
      <button
        aria-label="לא מתאים"
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg px-2 py-1 text-lg hover:bg-surface-2"
      >
        👎
      </button>
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-2xl border-t border-border bg-surface p-4 shadow-2xl md:absolute md:inset-x-auto md:bottom-auto md:mt-2 md:w-72 md:rounded-2xl md:border">
          <p className="mb-3 text-sm font-semibold">למה לא מתאים?</p>
          <div className="flex flex-wrap gap-2">
            {DOWN_REASONS.map((r) => (
              <button
                key={r}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await sendFeedback(jobId, "down", [r]);
                    setOpen(false);
                    setDone("down");
                  })
                }
                className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
              >
                {r}
              </button>
            ))}
          </div>
          <button onClick={() => setOpen(false)} className="mt-3 w-full py-2 text-sm text-muted">
            ביטול
          </button>
        </div>
      )}
    </div>
  );
}
