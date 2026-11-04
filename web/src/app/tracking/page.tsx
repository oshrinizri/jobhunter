import Link from "next/link";
import { Card, EmptyState, ScoreBadge, timeAgo } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/types";

const COLUMNS: { label: string; statuses: ApplicationStatus[] }[] = [
  { label: "שמורות", statuses: ["saved"] },
  { label: "הוגשו", statuses: ["applied"] },
  { label: "בתהליך", statuses: ["screening", "interview", "home_task"] },
  { label: "הצעות", statuses: ["offer", "hired"] },
  { label: "נסגרו", statuses: ["rejected", "no_response", "withdrawn"] },
];

export default async function TrackingPage() {
  const db = await supabaseServer();
  const { data: apps } = await db
    .from("applications")
    .select("id,status,interview_round,applied_at,updated_at,job:jobs(id,title,company,job_scores(total))")
    .order("updated_at", { ascending: false });

  type Row = {
    id: string;
    status: ApplicationStatus;
    interview_round: number;
    applied_at: string | null;
    updated_at: string;
    job: { id: string; title: string; company: string; job_scores: { total: number } | null } | null;
  };
  const rows = (apps ?? []) as unknown as Row[];

  const applied = rows.filter((r) => r.applied_at).length;
  const responded = rows.filter((r) => ["screening", "interview", "home_task", "offer", "hired", "rejected"].includes(r.status)).length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">מעקב הגשות</h1>

      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center"><div className="text-2xl font-bold tabular-nums">{rows.length}</div><div className="text-xs text-muted">במעקב</div></Card>
        <Card className="text-center"><div className="text-2xl font-bold tabular-nums">{applied}</div><div className="text-xs text-muted">הגשות</div></Card>
        <Card className="text-center">
          <div className="text-2xl font-bold tabular-nums">{applied ? Math.round((responded / applied) * 100) : 0}%</div>
          <div className="text-xs text-muted">אחוז תגובה</div>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="עוד לא שמרת או הגשת משרות" body="במסך המשרה לוחצים על 'שמורה' או '✓ הגשתי', והיא תופיע כאן." />
      ) : (
        <div className="space-y-5">
          {COLUMNS.map((col) => {
            const items = rows.filter((r) => col.statuses.includes(r.status));
            if (!items.length) return null;
            return (
              <section key={col.label}>
                <h2 className="mb-2 text-sm font-semibold text-muted">
                  {col.label} ({items.length})
                </h2>
                <div className="space-y-2">
                  {items.map((r) => (
                    <Link key={r.id} href={`/jobs/${r.job?.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                      <ScoreBadge score={r.job?.job_scores?.total ?? null} />
                      <div className="min-w-0 flex-1">
                        <p dir="auto" className="truncate text-right font-medium">{r.job?.title}</p>
                        <p className="truncate text-sm text-muted"><span className="ltr">{r.job?.company}</span></p>
                      </div>
                      <div className="text-end text-xs text-muted">
                        <div className="font-semibold text-text">
                          {STATUS_LABELS[r.status]}
                          {r.status === "interview" && r.interview_round > 1 ? ` ${r.interview_round}` : ""}
                        </div>
                        <div>{timeAgo(r.updated_at)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
