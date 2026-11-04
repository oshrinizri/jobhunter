"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addJobAction, type AddState } from "./actions";

export function AddJobForm() {
  const [state, action, pending] = useActionState<AddState, FormData>(addJobAction, null);

  return (
    <form action={action} className="space-y-3">
      <input
        name="url"
        type="url"
        inputMode="url"
        placeholder="https://…"
        className="ltr w-full rounded-xl border border-border bg-surface px-4 py-3 text-start"
      />
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">אין לינק? אפשר להדביק את טקסט המשרה</summary>
        <textarea
          name="text"
          rows={8}
          placeholder="טקסט המשרה המלא…"
          className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3"
        />
      </details>
      <button disabled={pending} className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60">
        {pending ? "קולט ומדרג…" : "הוספה ודירוג"}
      </button>

      {state && !state.ok && <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad">{state.error}</p>}
      {state?.ok && (
        <p className="rounded-xl bg-good-soft px-4 py-3 text-sm text-good">
          נוספה: <span className="ltr">{state.title}</span> ·{" "}
          <Link href={`/jobs/${state.id}`} className="font-semibold underline">לצפייה במשרה</Link>
        </p>
      )}
    </form>
  );
}
