import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusPicker } from "@/components/status-picker";
import { QuickFeedback } from "@/components/quick-feedback";
import { JobDescription } from "@/components/job-description";
import { Card, FILTER_LABELS, ScoreBadge, TAG_LABELS, Tag, commuteText, postedText } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizeCompanyName } from "@/lib/text";
import type { ApplicationStatus } from "@/lib/types";

const PARAM_LABELS: Record<string, string> = {
  skills: "התאמת כישורים",
  role: "תפקיד ורמה",
  commute: "נסיעה",
  stability: "יציבות חברה",
  salary: "שכר",
  domain: "תחום",
  hebrew: "סביבה עברית",
};

const SOURCE_LABELS: Record<string, string> = {
  greenhouse: "עמוד קריירה (Greenhouse)",
  lever: "עמוד קריירה (Lever)",
  comeet: "עמוד קריירה (Comeet)",
  linkedin_email: "LinkedIn",
  manual: "הוספה ידנית",
  alljobs: "AllJobs",
  drushim: "Drushim",
};

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const db = await supabaseServer();
  const { data: job } = await db.from("jobs_feed").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();

  const [{ data: card }, { data: app }, { data: sources }] = await Promise.all([
    db.from("company_cards").select("*").eq("company_name", normalizeCompanyName(job.company)).maybeSingle(),
    db.from("applications").select("*").eq("job_id", id).maybeSingle(),
    db.from("job_sources").select("source,url").eq("job_id", id),
  ]);

  const breakdown = (job.breakdown ?? {}) as Record<string, number | string | null>;
  const commute = commuteText(job.commute_transit_min, job.commute_drive_min);

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-muted">→ חזרה למשרות</Link>

      <header className="flex gap-4">
        <ScoreBadge score={job.filtered_out ? null : job.total} size="lg" />
        <div className="min-w-0">
          <h1 dir="auto" className="text-right text-xl font-bold leading-snug">{job.title}</h1>
          <p className="text-muted">
            <span className="ltr">{job.company}</span>
            {job.location ? ` · ${job.location}` : ""}
          </p>
          <p className="text-sm text-muted">{[postedText(job.posted_at, job.first_seen_at), commute].filter(Boolean).join(" · ")}</p>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {job.filtered_out && <Tag tone="bad">סונן: {FILTER_LABELS[job.filtered_out] ?? job.filtered_out}</Tag>}
        {(job.tags ?? []).map((t: string) => <Tag key={t}>{TAG_LABELS[t] ?? t}</Tag>)}
        {!job.is_open && <Tag tone="bad">המשרה נסגרה</Tag>}
      </div>

      {/* Actions */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {job.apply_url && (
            <a href={job.apply_url} target="_blank" rel="noreferrer" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
              פתיחת עמוד ההגשה ↗
            </a>
          )}
          {job.apply_email && (
            <span className="text-sm text-muted">
              הגשה במייל: <span className="ltr font-mono">{job.apply_email}</span>
            </span>
          )}
          <div className="ms-auto"><QuickFeedback jobId={id} /></div>
        </div>
        <StatusPicker jobId={id} status={(app?.status as ApplicationStatus) ?? null} />
        <Link href={`/jobs/${id}/cv`} className="block rounded-xl border border-accent bg-accent-soft py-2 text-center text-sm font-semibold text-accent">
          📄 קורות חיים ומכתב מקדים מותאמים למשרה
        </Link>
      </Card>

      {/* Why this score */}
      {job.explanation && (
        <Card>
          <h2 className="mb-2 font-semibold">למה {job.total}?</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">{job.explanation}</p>
          {(job.missing_skills ?? []).length > 0 && (
            <p className="mt-3 text-sm">
              <span className="font-semibold text-bad">חסר: </span>
              <span className="ltr">{job.missing_skills.join(", ")}</span>
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {Object.entries(PARAM_LABELS).map(([k, label]) =>
              typeof breakdown[k] === "number" ? (
                <div key={k}>
                  <div className="flex justify-between text-xs text-muted">
                    <span>{label}</span>
                    <span className="tabular-nums">{breakdown[k]}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${breakdown[k]}%` }} />
                  </div>
                </div>
              ) : null,
            )}
          </div>
          {job.salary_estimate && (
            <p className="mt-4 text-xs text-muted">
              הערכת שכר: ~{Number(job.salary_estimate).toLocaleString("he-IL")} ₪ (הערכת AI)
              {breakdown.hidden_client_guess ? ` · ניחוש לקוח: ${breakdown.hidden_client_guess}` : ""}
            </p>
          )}
        </Card>
      )}

      {/* Company card */}
      {card && (
        <Card>
          <h2 className="mb-1 font-semibold">
            <span className="ltr">{job.company}</span> · דרגת יציבות {breakdown.tier ?? card.tier}
          </h2>
          {card.summary && <p className="text-sm">{card.summary}</p>}
          <p className="mt-2 text-xs text-muted">
            {[
              card.is_public ? "חברה ציבורית" : card.is_public === false ? "חברה פרטית" : null,
              card.employees ? `~${card.employees} עובדים` : null,
              card.funding_stage,
              card.recent_layoffs ? "פיטורים ב-12 חודשים אחרונים" : null,
              card.sector,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Card>
      )}

      {/* Description */}
      <Card>
        <JobDescription jobId={id} text={job.description ?? ""} isEnglish={job.language === "en"} />
      </Card>

      {sources && sources.length > 0 && (
        <p className="text-xs text-muted">
          מקורות:{" "}
          {sources.map((s, i) => (
            <span key={i}>
              {i > 0 && " · "}
              {s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">{SOURCE_LABELS[s.source] ?? s.source}</a> : SOURCE_LABELS[s.source] ?? s.source}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
