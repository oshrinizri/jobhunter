"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" width={72} height={72} className="rounded-2xl" />
      <div>
        <h1 className="text-2xl font-bold">JobHunter</h1>
        <p className="mt-1 text-muted">משרות שמתאימות לך, מדורגות ומוסברות</p>
      </div>
      <button
        onClick={signIn}
        disabled={loading}
        className="rounded-xl bg-accent px-6 py-3 font-semibold text-white shadow-sm disabled:opacity-60"
      >
        {loading ? "מתחבר…" : "התחברות עם Google"}
      </button>
    </div>
  );
}
