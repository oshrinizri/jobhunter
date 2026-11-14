import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm, GenerateButton, PrintButton } from "./client";
import { CvDocument } from "@/components/cv-document";
import { EMPTY_CONTACT, type CvDoc } from "@/lib/cv";
import { supabaseServer } from "@/lib/supabase/server";

export default async function CvPage({ params }: PageProps<"/cv/[lang]">) {
  const { lang } = await params;
  if (lang !== "he" && lang !== "en") notFound();

  const db = await supabaseServer();
  const { data } = await db.from("cv_base").select("content,updated_at").eq("lang", lang).maybeSingle();
  const cv = data?.content as CvDoc | undefined;
  const hasBody = Boolean(cv?.experience);

  return (
    <div className="space-y-4">
      <div className="no-print flex items-baseline justify-between">
        <h1 className="text-xl font-bold">{lang === "he" ? "קורות חיים · עברית" : "קורות חיים · English"}</h1>
        <div className="flex gap-3 text-sm">
          <Link href={lang === "he" ? "/cv/en" : "/cv/he"} className="text-accent">
            {lang === "he" ? "English" : "עברית"}
          </Link>
          <Link href="/profile" className="text-muted">
            לפרופיל
          </Link>
        </div>
      </div>

      <div className="no-print space-y-2">
        {hasBody && <PrintButton />}
        <GenerateButton lang={lang} hasCv={hasBody} />
        {hasBody && <ContactForm contact={{ ...EMPTY_CONTACT, ...cv?.contact }} />}
        {hasBody && (
          <p className="text-xs text-muted">
            ב-PDF: בחלון ההדפסה בוחרים &quot;שמירה כ-PDF&quot;. באייפון: שיתוף ← הדפסה ← צביטה בתצוגה המקדימה ← שמירה.
          </p>
        )}
      </div>

      {hasBody && cv ? (
        <div className="-mx-4 overflow-x-auto bg-neutral-200 p-3 print:m-0 print:bg-white print:p-0 md:mx-0 md:rounded-2xl">
          <CvDocument cv={cv} lang={lang} />
        </div>
      ) : (
        <p className="no-print rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted">
          עוד לא נוצרו קורות חיים בשפה הזו. הם נכתבים מהפרופיל שלך, בלי להמציא שום דבר.
        </p>
      )}
    </div>
  );
}
