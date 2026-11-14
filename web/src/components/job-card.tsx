import Link from "next/link";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/types";
import { FILTER_LABELS, ScoreBadge, TAG_LABELS, Tag, commuteText, postedText } from "./ui";
import { QuickFeedback } from "./quick-feedback";

export interface FeedJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: string | null;
  posted_at: string | null;
  first_seen_at: string;
  total: number | null;
  explanation: string | null;
  tags: string[] | null;
  missing_skills: string[] | null;
  commute_transit_min: number | null;
  commute_drive_min: number | null;
  application_status: ApplicationStatus | null;
  filtered_out: string | null;
}

export function JobCard({ job }: { job: FeedJob }) {
  const commute = commuteText(job.commute_transit_min, job.commute_drive_min);
  return (
    <article className="rounded-2xl border border-border bg-surface p-4">
      <Link href={`/jobs/${job.id}`} className="flex gap-3">
        <ScoreBadge score={job.filtered_out ? null : job.total} />
        <div className="min-w-0 flex-1">
          <h2 dir="auto" className="truncate text-right font-semibold leading-snug">{job.title}</h2>
          <p className="truncate text-sm text-muted">
            <span className="ltr">{job.company}</span>
            {job.location ? ` · ${job.location}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {[postedText(job.posted_at, job.first_seen_at), commute].filter(Boolean).join(" · ")}
          </p>
        </div>
      </Link>

      {job.explanation && !job.filtered_out && <p className="mt-3 line-clamp-2 text-sm">{job.explanation}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {job.application_status && <Tag tone="accent">{STATUS_LABELS[job.application_status]}</Tag>}
        {job.filtered_out && <Tag tone="bad">סונן: {FILTER_LABELS[job.filtered_out] ?? job.filtered_out}</Tag>}
        {(job.tags ?? []).map((t) => (
          <Tag key={t}>{TAG_LABELS[t] ?? t}</Tag>
        ))}
        {(job.missing_skills ?? []).length > 0 && (
          <Tag tone="bad">
            חסר:&nbsp;<span className="ltr">{(job.missing_skills ?? []).slice(0, 3).join(", ")}</span>
          </Tag>
        )}
        <div className="ms-auto">
          <QuickFeedback jobId={job.id} />
        </div>
      </div>
    </article>
  );
}
