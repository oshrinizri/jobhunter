import { SettingsForm } from "./form";
import { supabaseServer } from "@/lib/supabase/server";
import { DEFAULT_MAX_JOB_AGE_DAYS, DEFAULT_WEIGHTS, SCAN_DEFAULTS } from "@/lib/types";

export default async function SettingsPage() {
  const db = await supabaseServer();
  const { data: prefs } = await db.from("preferences").select("*").maybeSingle();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!prefs) return <p className="text-muted">לא נמצאו הגדרות.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">הגדרות</h1>
      <SettingsForm
        prefs={{
          ...SCAN_DEFAULTS,
          ...prefs,
          weights: { ...DEFAULT_WEIGHTS, ...prefs.weights },
          max_job_age_days: prefs.max_job_age_days ?? DEFAULT_MAX_JOB_AGE_DAYS,
        }}
      />
      <p className="text-center text-xs text-muted">
        מחובר כ-<span className="ltr">{user?.email}</span>
      </p>
    </div>
  );
}
