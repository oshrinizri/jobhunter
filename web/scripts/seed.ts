// One-time setup after the first Google sign-in:
//   npx tsx scripts/seed.ts
// Seeds the master profile from the CV, the starter company list and the blacklist.
import { config } from "dotenv";
config({ path: ".env.local" });
import { PROFILE_SEED } from "../src/lib/profile-seed";
import { supabaseAdmin } from "../src/lib/supabase/admin";

// Verified public boards (checked 2026-11-04). The AI discovery script adds more.
const STARTER_COMPANIES = [
  { name: "Payoneer", ats: "greenhouse", ats_board: "payoneer" },
  { name: "Similarweb", ats: "greenhouse", ats_board: "similarweb" },
  { name: "Taboola", ats: "greenhouse", ats_board: "taboola" },
  { name: "AppsFlyer", ats: "greenhouse", ats_board: "appsflyer" },
  { name: "Riskified", ats: "greenhouse", ats_board: "riskified" },
  { name: "NICE", ats: "greenhouse", ats_board: "nice" },
  { name: "Via", ats: "greenhouse", ats_board: "via" },
];

const BLACKLIST = ["Bank Hapoalim", "G-STAT"];

async function main() {
  const db = supabaseAdmin();
  const { data: users } = await db.from("preferences").select("user_id");
  if (!users?.length) throw new Error("No user yet — sign in to the app with Google first, then run this again.");

  for (const { user_id } of users) {
    const { count } = await db.from("master_profile_items").select("id", { count: "exact", head: true }).eq("user_id", user_id);
    if (!count) {
      await db.from("master_profile_items").insert(PROFILE_SEED.map((p, i) => ({ ...p, user_id, sort_order: i })));
      console.log(`✓ master profile seeded (${PROFILE_SEED.length} items)`);
    }
    await db.from("companies").upsert(
      [
        ...STARTER_COMPANIES.map((c) => ({ ...c, user_id, status: "active" })),
        ...BLACKLIST.map((name) => ({ name, user_id, ats: "none", status: "blacklist" })),
      ],
      { onConflict: "user_id,name", ignoreDuplicates: true },
    );
    console.log(`✓ ${STARTER_COMPANIES.length} companies + ${BLACKLIST.length} blacklisted`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
