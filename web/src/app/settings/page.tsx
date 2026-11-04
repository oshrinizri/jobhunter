import { SettingsForm } from "./form";
import { supabaseServer } from "@/lib/supabase/server";
import { DEFAULT_WEIGHTS } from "@/lib/types";

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
      <SettingsForm prefs={{ ...prefs, weights: { ...DEFAULT_WEIGHTS, ...prefs.weights } }} />
      <p className="text-center text-xs text-muted">
        מחובר כ-<span className="ltr">{user?.email}</span>
      </p>
    </div>
  );
}
