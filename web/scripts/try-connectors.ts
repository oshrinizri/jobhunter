// Quick manual check of the ATS connectors against real boards.
// Run: npx tsx scripts/try-connectors.ts
import { detectBoard, fetchCompanyJobs } from "../src/lib/connectors/ats";

const candidates = ["payoneer", "similarweb", "taboola", "appsflyer", "riskified", "outbrain", "nice", "via", "lightricks", "melio"];

async function main() {
  for (const slug of candidates) {
    const board = await detectBoard(slug);
    if (!board) {
      console.log(`✗ ${slug}: no public Greenhouse/Lever board`);
      continue;
    }
    const jobs = await fetchCompanyJobs({ name: slug, ats: board.ats, ats_board: board.board, ats_token: null });
    const data = jobs.filter((j) => /data|analyst|bi\b|analytics/i.test(j.title));
    console.log(`✓ ${slug} (${board.ats}): ${board.count} total, ${jobs.length} in Israel, ${data.length} data-related`);
    for (const j of data.slice(0, 3)) console.log(`    - ${j.title} | ${j.location} | ${j.remote} | ${j.description.length} chars`);
  }
}

main();
