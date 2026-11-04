import { headers } from "next/headers";
import { AddJobForm } from "./form";
import { Card } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";

export default async function AddPage() {
  const db = await supabaseServer();
  const { data: prefs } = await db.from("preferences").select("ingest_token").maybeSingle();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const endpoint = `${origin}/api/ingest`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">הוספת משרה</h1>
      <p className="text-sm text-muted">
        לינק ממשרה ב-LinkedIn, באתר חברה או בכל מקום אחר. המשרה תיקלט ותקבל ציון תוך כחצי דקה.
      </p>
      <AddJobForm />

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold">📱 הוספה מהירה מה-iPhone</h2>
        <p className="text-muted">
          אחרי שתתקין את קיצור הדרך &quot;הוסף ל-JobHunter&quot;, הוא יופיע בתפריט השיתוף של LinkedIn ו-Safari. ההוראות
          המלאות נמצאות בקובץ <span className="ltr font-mono">SETUP.md</span>. אלה הפרטים שצריך להזין בו:
        </p>
        <dl className="space-y-1">
          <dt className="text-muted">כתובת:</dt>
          <dd className="ltr select-all break-all rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs">{endpoint}</dd>
          <dt className="text-muted">מפתח אישי:</dt>
          <dd className="ltr select-all break-all rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs">{prefs?.ingest_token ?? "—"}</dd>
        </dl>
      </Card>
    </div>
  );
}
