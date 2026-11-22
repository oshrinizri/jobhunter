// Dry run of the hard filters + score math on real boards (no AI, no DB).
// Run: npx tsx scripts/try-filters.ts
import { fetchCompanyJobs } from "../src/lib/connectors/ats";
import { FIXED_BLACKLIST } from "../src/lib/pipeline";
import { commuteScore } from "../src/lib/scoring/commute";
import { hardFilter } from "../src/lib/scoring/filters";
import { combine } from "../src/lib/scoring/score";
import { DEFAULT_WEIGHTS, SCAN_DEFAULTS, type Preferences } from "../src/lib/types";

const prefs: Preferences = {
  home_address: "קריית אונו",
  max_commute_min: 45,
  target_salary: 23000,
  role_tracks: ["Data Analyst", "BI Developer", "Data Engineer", "Product Analyst"],
  weights: DEFAULT_WEIGHTS,
  preferred_domains: ["fintech", "health"],
  negative_keywords: ["sales", "account executive", "student", "סטודנט"],
  preference_notes: "",
  max_job_age_days: 30,
  ...SCAN_DEFAULTS,
};

async function main() {
  const boards = ["similarweb", "taboola", "appsflyer", "payoneer", "riskified"];
  const counts: Record<string, number> = {};
  const passed: string[] = [];
  for (const b of boards) {
    const jobs = await fetchCompanyJobs({ name: b, ats: "greenhouse", ats_board: b, ats_token: null });
    for (const j of jobs) {
      const r = hardFilter(j, prefs, FIXED_BLACKLIST) ?? "PASS";
      counts[r] = (counts[r] ?? 0) + 1;
      if (r === "PASS") passed.push(`${b}: ${j.title} (${j.remote})`);
    }
  }
  console.log("filter results:", counts);
  console.log("passed to AI scoring:\n  " + passed.join("\n  "));

  // Score math sanity checks
  console.log("\ncommute 22 min onsite →", commuteScore({ driveMin: 22, transitMin: 38 }, "onsite", 45));
  console.log("commute 44 min onsite →", commuteScore({ driveMin: 44, transitMin: 60 }, "onsite", 45));
  console.log("commute 55 min hybrid →", commuteScore({ driveMin: 55, transitMin: 70 }, "hybrid", 45));
  console.log("commute 60 min onsite →", commuteScore({ driveMin: 60, transitMin: 70 }, "onsite", 45));
  console.log("all-100 total →", combine({ skills: 100, role: 100, commute: 100, stability: 100, salary: 100, domain: 100, hebrew: 100 }, DEFAULT_WEIGHTS));
  console.log("mixed total →", combine({ skills: 80, role: 70, commute: 90, stability: 80, salary: 60, domain: 50, hebrew: 40 }, DEFAULT_WEIGHTS));
}

main();
