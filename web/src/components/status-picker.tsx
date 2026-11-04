"use client";

import { useTransition } from "react";
import { setStatus } from "@/app/actions";
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/types";

export function StatusPicker({ jobId, status }: { jobId: string; status: ApplicationStatus | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1.5">
      {APPLICATION_STATUSES.map((s) => (
        <button
          key={s}
          disabled={pending}
          onClick={() => start(() => setStatus(jobId, s))}
          className={`rounded-full px-3 py-1 text-xs ${
            status === s ? "bg-accent font-semibold text-white" : "border border-border text-muted hover:bg-surface-2"
          } disabled:opacity-60`}
        >
          {s === "applied" && status !== "applied" ? "✓ הגשתי" : STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
