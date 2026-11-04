// Scheduled ingest: fetch all active company boards, store new jobs, filter and score them.
// Runs twice a day from GitHub Actions (.github/workflows/ingest.yml) or locally:
//   npx tsx scripts/ingest.ts
import { config } from "dotenv";
config({ path: ".env.local" });
import { fetchCompanyJobs } from "../src/lib/connectors/ats";
import { loadUserContext, processJob, upsertJob } from "../src/lib/pipeline";
import { supabaseAdmin } from "../src/lib/supabase/admin";

// Cost guard: at most this many AI scorings per run (SPEC §17 risk #7).
const MAX_SCORE_PER_RUN = Number(process.env.MAX_SCORE_PER_RUN ?? 150);

async function main() {
  const db = supabaseAdmin();
  const runStart = new Date().toISOString();
  const { data: users, error } = await db.from("preferences").select("user_id");
  if (error) throw error;

  for (const { user_id: userId } of users ?? []) {
    const ctx = await loadUserContext(db, userId);
    const { data: companies } = await db
      .from("companies")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("ats", ["greenhouse", "lever", "comeet"]);

    let fetched = 0, added = 0, scored = 0, filtered = 0, skipped = 0;
    const toProcess: { id: string; raw: Awaited<ReturnType<typeof fetchCompanyJobs>>[number] }[] = [];

    for (const c of companies ?? []) {
      try {
        const jobs = await fetchCompanyJobs(c);
        fetched += jobs.length;
        for (const raw of jobs) {
          const { id, isNew } = await upsertJob(db, userId, raw);
          if (isNew) {
            added++;
            toProcess.push({ id, raw });
          }
        }
        await db.from("companies").update({ last_fetched_at: runStart, last_fetch_count: jobs.length, last_fetch_error: null }).eq("id", c.id);
        // Jobs from this board that disappeared are closed.
        await db.from("jobs").update({ is_open: false }).eq("user_id", userId).eq("company", c.name).lt("last_seen_at", runStart);
      } catch (e) {
        const msg = (e as Error).message;
        console.warn(`✗ ${c.name}: ${msg}`);
        await db.from("companies").update({ last_fetch_error: msg.slice(0, 500) }).eq("id", c.id);
      }
    }

    // Also retry jobs stored earlier but never scored (e.g. API key was missing, or budget hit).
    const { data: pending } = await db
      .from("jobs_feed")
      .select("id,title,company,location,remote,description,apply_email,apply_url,posted_at,company_hidden")
      .eq("user_id", userId)
      .is("total", null)
      .is("filtered_out", null)
      .eq("is_open", true)
      .limit(MAX_SCORE_PER_RUN);
    for (const p of pending ?? []) {
      if (toProcess.some((t) => t.id === p.id)) continue;
      toProcess.push({
        id: p.id,
        raw: {
          source: "manual", externalId: p.id, url: p.apply_url ?? "", title: p.title, company: p.company,
          companyHidden: p.company_hidden, location: p.location, remote: p.remote, description: p.description,
          applyEmail: p.apply_email, applyUrl: p.apply_url, postedAt: p.posted_at,
        },
      });
    }

    for (const { id, raw } of toProcess) {
      if (scored >= MAX_SCORE_PER_RUN) { skipped++; continue; }
      try {
        const r = await processJob(db, ctx, id, raw);
        if (r === "scored") scored++;
        else if (r === "filtered") filtered++;
        else skipped++;
      } catch (e) {
        skipped++;
        console.warn(`✗ score "${raw.title}" @ ${raw.company}: ${(e as Error).message}`);
      }
    }

    console.log(`user ${userId.slice(0, 8)}: ${companies?.length ?? 0} companies, ${fetched} Israeli jobs fetched, ${added} new, ${filtered} filtered, ${scored} scored, ${skipped} pending`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
