import Link from "next/link";
import { JobCard, type FeedJob } from "@/components/job-card";
import { EmptyState } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { DEFAULT_MAX_JOB_AGE_DAYS, ageCutoffIso } from "@/lib/types";

const VIEWS = [
  { key: "top", label: "מומלצות" },
  { key: "all", label: "כל המשרות" },
  { key: "saved", label: "שמורות" },
  { key: "filtered", label: "סוננו" },
] as const;
type View = (typeof VIEWS)[number]["key"];

const SORTS = [
  { key: "score", label: "לפי התאמה" },
  { key: "new", label: "החדשות קודם" },
] as const;
type Sort = (typeof SORTS)[number]["key"];

export default async function FeedPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : "top") as View;
  const sort = (SORTS.some((s) => s.key === sp.sort) ? sp.sort : "score") as Sort;

  const db = await supabaseServer();
  const { data: prefs } = await db.from("preferences").select("*").maybeSingle();
  const maxAge: number = prefs?.max_job_age_days ?? DEFAULT_MAX_JOB_AGE_DAYS;

  let q = db
    .from("jobs_feed")
    .select(
      "id,title,company,location,remote,posted_at,first_seen_at,total,explanation,tags,missing_skills,commute_transit_min,commute_drive_min,application_status,filtered_out",
    )
    .eq("is_open", true);

  // Age limit applies to the discovery views; jobs added by hand always show.
  const ageLimited = view === "top" || view === "all";
  if (ageLimited) {
    q = q.or(`posted_at.is.null,posted_at.gte.${ageCutoffIso(maxAge)},sources.cs.{manual},sources.cs.{linkedin_email}`);
  }

  if (view === "top") q = q.is("filtered_out", null).gte("total", 60);
  if (view === "all") q = q.is("filtered_out", null);
  if (view === "saved") q = q.not("application_status", "is", null);
  if (view === "filtered") q = q.not("filtered_out", "is", null);

  if (sort === "new" || view === "saved" || view === "filtered") {
    q = q.order("posted_at", { ascending: false, nullsFirst: false }).order("first_seen_at", { ascending: false });
  } else {
    q = q.order("total", { ascending: false, nullsFirst: false });
  }

  const { data: jobs, error } = await q.limit(100);

  const href = (v: View, s: Sort) => {
    const params = new URLSearchParams();
    if (v !== "top") params.set("view", v);
    if (s !== "score") params.set("sort", s);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

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
            href={href(v.key, sort)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${view === v.key ? "bg-text text-bg" : "border border-border bg-surface text-muted"}`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {ageLimited && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={href(view, s.key)}
                className={`rounded-full px-3 py-1 ${sort === s.key ? "bg-accent-soft text-accent" : "hover:bg-surface-2"}`}
              >
                {s.label}
              </Link>
            ))}
          </div>
          <Link href="/settings" className="hover:underline">
            פורסמו ב-{maxAge} הימים האחרונים
          </Link>
        </div>
      )}

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
