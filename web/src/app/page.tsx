import Link from "next/link";
import { JobCard, type FeedJob } from "@/components/job-card";
import { EmptyState } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";

const VIEWS = [
  { key: "top", label: "מומלצות" },
  { key: "all", label: "כל המשרות" },
  { key: "saved", label: "שמורות" },
  { key: "filtered", label: "סוננו" },
] as const;
type View = (typeof VIEWS)[number]["key"];

export default async function FeedPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : "top") as View;

  const db = await supabaseServer();
  let q = db
    .from("jobs_feed")
    .select(
      "id,title,company,location,remote,posted_at,first_seen_at,total,explanation,tags,missing_skills,commute_transit_min,commute_drive_min,application_status,filtered_out",
    )
    .eq("is_open", true);

  if (view === "top") q = q.is("filtered_out", null).gte("total", 60).order("total", { ascending: false });
  if (view === "all") q = q.is("filtered_out", null).order("total", { ascending: false, nullsFirst: false });
  if (view === "saved") q = q.not("application_status", "is", null).order("first_seen_at", { ascending: false });
  if (view === "filtered") q = q.not("filtered_out", "is", null).order("first_seen_at", { ascending: false });

  const { data: jobs, error } = await q.limit(100);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">משרות</h1>
        <span className="text-sm text-muted">{jobs?.length ?? 0} משרות</span>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "top" ? "/" : `/?view=${v.key}`}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${view === v.key ? "bg-text text-bg" : "border border-border bg-surface text-muted"}`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {error && <p className="text-sm text-bad">שגיאה בטעינה: {error.message}</p>}

      {jobs && jobs.length > 0 ? (
        <div className="space-y-3">
          {(jobs as FeedJob[]).map((j) => (
            <JobCard key={j.id} job={j} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={view === "top" ? "עוד אין משרות מומלצות" : "אין כאן משרות"}
          body={
            view === "top" ? (
              <>הסריקה רצה פעמיים ביום. אפשר גם <Link className="text-accent underline" href="/add">להוסיף משרה ידנית</Link>.</>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
