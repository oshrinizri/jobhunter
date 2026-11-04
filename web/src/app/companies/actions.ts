"use server";

import { revalidatePath } from "next/cache";
import { detectBoard } from "@/lib/connectors/ats";
import { supabaseServer } from "@/lib/supabase/server";

async function ctx() {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("not signed in");
  return { db, user };
}

export type CompanyFormState = { ok?: string; error?: string } | null;

/** Add a company: try to find its public Greenhouse / Lever board by name. */
export async function addCompany(_prev: CompanyFormState, form: FormData): Promise<CompanyFormState> {
  const { db, user } = await ctx();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "צריך שם חברה" };
  const slugGuesses = [...new Set([name.toLowerCase().replace(/[^a-z0-9]/g, ""), name.toLowerCase().replace(/\s+/g, "-")])];

  let board: Awaited<ReturnType<typeof detectBoard>> = null;
  for (const s of slugGuesses) {
    board = await detectBoard(s);
    if (board) break;
  }
  const { error } = await db.from("companies").upsert(
    {
      user_id: user.id,
      name,
      ats: board?.ats ?? "none",
      ats_board: board?.board ?? null,
      status: "active",
    },
    { onConflict: "user_id,name" },
  );
  if (error) return { error: error.message };
  revalidatePath("/companies");
  return board
    ? { ok: `נמצא לוח משרות ב-${board.ats} עם ${board.count} משרות. החברה תיסרק מעכשיו.` }
    : { ok: "החברה נוספה, אבל לא נמצא לה לוח משרות ציבורי. משרות שלה ייקלטו דרך LinkedIn או בהוספה ידנית." };
}

export async function setCompanyStatus(id: string, status: "active" | "blacklist" | "paused") {
  const { db } = await ctx();
  await db.from("companies").update({ status }).eq("id", id);
  revalidatePath("/companies");
}

export async function setTierOverride(id: string, tier: "A" | "B" | "C" | null) {
  const { db } = await ctx();
  await db.from("companies").update({ tier_override: tier }).eq("id", id);
  revalidatePath("/companies");
}
