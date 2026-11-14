// Printable, ATS-friendly CV (A4). Plain structure: headings, text, bullet lists — no tables or graphics.
import type { CvDoc } from "@/lib/cv";

const T = {
  he: {
    summary: "תקציר",
    experience: "ניסיון תעסוקתי",
    education: "השכלה",
    courses: "קורסים והכשרות",
    skills: "כישורים",
    languages: "שפות",
    military: "שירות צבאי",
  },
  en: {
    summary: "Summary",
    experience: "Experience",
    education: "Education",
    courses: "Courses & Training",
    skills: "Skills",
    languages: "Languages",
    military: "Military Service",
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="cv-section">
      <h2 className="mb-1.5 border-b border-neutral-300 pb-0.5 text-[13px] font-bold tracking-wide text-[#1f3b8a] uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function CvDocument({ cv, lang }: { cv: CvDoc; lang: "he" | "en" }) {
  const t = T[lang];
  const c = cv.contact;
  const contactLine = [c.phone, c.email, c.city, c.linkedin].filter(Boolean);
  return (
    <article
      dir={lang === "he" ? "rtl" : "ltr"}
      lang={lang}
      className="cv-page mx-auto space-y-4 bg-white p-8 text-[12.5px] leading-relaxed text-neutral-900 shadow-sm print:p-0 print:shadow-none"
    >
      <header className="text-center">
        <h1 className="text-[24px] font-bold">{c.name || "שם מלא"}</h1>
        <p className="text-[14px] text-neutral-700">{c.headline || cv.headline}</p>
        {contactLine.length > 0 && (
          <p className="mt-1 text-[12px] text-neutral-600">
            {contactLine.map((x, i) => (
              <span key={i}>
                {i > 0 && " · "}
                <span dir="ltr">{x}</span>
              </span>
            ))}
          </p>
        )}
      </header>

      {cv.summary && (
        <Section title={t.summary}>
          <p>{cv.summary}</p>
        </Section>
      )}

      {cv.experience?.length > 0 && (
        <Section title={t.experience}>
          <div className="space-y-2.5">
            {cv.experience.map((e, i) => (
              <div key={i} className="cv-avoid-break">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold">
                    {e.title}
                    {e.org && <span className="font-normal"> · {e.org}</span>}
                  </p>
                  <p dir="ltr" className="text-[11.5px] text-neutral-600">{e.period}</p>
                </div>
                <ul className="mt-0.5 list-disc space-y-0.5 ps-5">
                  {e.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.education?.length > 0 && (
        <Section title={t.education}>
          <div className="space-y-1.5">
            {cv.education.map((e, i) => (
              <div key={i} className="cv-avoid-break">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-semibold">
                    {e.title}
                    {e.org && <span className="font-normal"> · {e.org}</span>}
                  </p>
                  <p dir="ltr" className="text-[11.5px] text-neutral-600">{e.period}</p>
                </div>
                {e.details && <p>{e.details}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.courses?.length > 0 && (
        <Section title={t.courses}>
          <ul className="list-disc space-y-0.5 ps-5">
            {cv.courses.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.title}</span>
                {e.org && ` · ${e.org}`}
                {e.period && <span dir="ltr" className="text-neutral-600"> ({e.period})</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {cv.skills?.length > 0 && (
        <Section title={t.skills}>
          <div className="space-y-0.5">
            {cv.skills.map((s, i) => (
              <p key={i}>
                <span className="font-semibold">{s.group}: </span>
                <span dir="ltr">{s.items.join(", ")}</span>
              </p>
            ))}
          </div>
        </Section>
      )}

      {cv.languages?.length > 0 && (
        <Section title={t.languages}>
          <p>{cv.languages.join(" · ")}</p>
        </Section>
      )}

      {cv.military && (
        <Section title={t.military}>
          <p>{cv.military}</p>
        </Section>
      )}
    </article>
  );
}
