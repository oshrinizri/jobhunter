import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyBox, TailorButton } from "./client";
import { PrintButton } from "@/app/cv/[lang]/client";
import { Card } from "@/components/ui";
import { CvDocument } from "@/components/cv-document";
import type { TailoredDoc } from "@/lib/cv";
import { supabaseServer } from "@/lib/supabase/server";

export default async function TailoredCvPage({ params }: PageProps<"/jobs/[id]/cv">) {
  const { id } = await params;
  const db = await supabaseServer();
  const [{ data: job }, { data: version }] = await Promise.all([
    db.from("jobs").select("id,title,company,language").eq("id", id).maybeSingle(),
    db.from("cv_versions").select("*").eq("job_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!job) notFound();

  // SPEC §8.3: CV language follows the posting's language.
  const jobLang: "he" | "en" = job.language === "he" ? "he" : "en";
  const doc = version?.content as TailoredDoc | undefined;
  const lang = (version?.lang as "he" | "en" | undefined) ?? jobLang;

  return (
    <div className="space-y-4">
      <div className="no-print space-y-1">
        <Link href={`/jobs/${id}`} className="text-sm text-muted">
          → חזרה למשרה
        </Link>
        <h1 className="text-xl font-bold">קורות חיים מותאמים</h1>
        <p dir="auto" className="text-right text-sm text-muted">
          {job.title} · <span className="ltr">{job.company}</span>
        </p>
      </div>

      <div className="no-print space-y-2">
        {doc && <PrintButton />}
        <TailorButton jobId={id} lang={jobLang} hasVersion={Boolean(doc)} />
        {!doc && (
          <p className="text-xs text-muted">
            המשרה ב{jobLang === "he" ? "עברית" : "אנגלית"}, ולכן קורות החיים ייכתבו ב{jobLang === "he" ? "עברית" : "אנגלית"}. העובדות נלקחות רק מהפרופיל שלך. ה-AI בוחר מה להבליט ומנסח מחדש, ולא ממציא.
          </p>
        )}
      </div>

      {doc && (
        <div className="no-print grid gap-3 md:grid-cols-2">
          <Card className="space-y-1">
            <h2 className="font-semibold">מה שונה בגרסה הזו</h2>
            <ul className="list-inside list-disc text-sm">
              {doc.changes_he.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </Card>
          {doc.gaps_he.length > 0 && (
            <Card className="space-y-1">
              <h2 className="font-semibold text-bad">דרישות שאין בפרופיל</h2>
              <ul className="list-inside list-disc text-sm">
                {doc.gaps_he.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              <p className="text-xs text-muted">לא הוכנסו לקורות החיים. אם בכל זאת יש לך ניסיון בהם, כדאי להוסיף אותו בפרופיל וליצור גרסה חדשה.</p>
            </Card>
          )}
        </div>
      )}

      {version?.cover_letter && (
        <Card className="no-print">
          <CopyBox text={version.cover_letter} label="מכתב מקדים (לגוף המייל)" />
        </Card>
      )}

      {doc && (
        <div className="-mx-4 overflow-x-auto bg-neutral-200 p-3 print:m-0 print:bg-white print:p-0 md:mx-0 md:rounded-2xl">
          <CvDocument cv={doc} lang={lang} />
        </div>
      )}
    </div>
  );
}
