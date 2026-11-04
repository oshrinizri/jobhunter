"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";

async function userOrThrow() {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("not signed in");
  return { db, user };
}

/** 👍 / 👎 / hide / open, with optional reason chips (SPEC §11). */
export async function sendFeedback(jobId: string, kind: "up" | "down" | "hide" | "open" | "save", reasons: string[] = []) {
  const { db, user } = await userOrThrow();
  await db.from("feedback").insert({ user_id: user.id, job_id: jobId, kind, reasons });
  if (kind === "save") await setStatus(jobId, "saved");
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}`);
}

export async function fixScore(jobId: string, score: number, note: string) {
  const { db, user } = await userOrThrow();
  await db.from("feedback").insert({ user_id: user.id, job_id: jobId, kind: "score_fix", score_fix: score, note });
  revalidatePath(`/jobs/${jobId}`);
}

export async function setStatus(jobId: string, status: ApplicationStatus) {
  if (!APPLICATION_STATUSES.includes(status)) throw new Error("bad status");
  const { db, user } = await userOrThrow();
  const now = new Date().toISOString();

  const { data: existing } = await db.from("applications").select("id,status,interview_round").eq("job_id", jobId).maybeSingle();
  const patch: Record<string, unknown> = { status, updated_at: now };
  if (status === "applied" && existing?.status !== "applied") patch.applied_at = now;
  if (status === "interview") patch.interview_round = (existing?.interview_round ?? 0) + 1;

  let appId = existing?.id as string | undefined;
  if (existing) {
    await db.from("applications").update(patch).eq("id", existing.id);
  } else {
    const { data } = await db
      .from("applications")
      .insert({ user_id: user.id, job_id: jobId, ...patch })
      .select("id")
      .single();
    appId = data?.id;
  }
  if (appId) {
    await db.from("application_events").insert({
      application_id: appId,
      kind: "status_change",
      payload: { from: existing?.status ?? null, to: status },
    });
  }
  revalidatePath("/");
  revalidatePath("/tracking");
  revalidatePath(`/jobs/${jobId}`);
}

export async function saveNotes(jobId: string, notes: string) {
  const { db } = await userOrThrow();
  await db.from("applications").update({ notes, updated_at: new Date().toISOString() }).eq("job_id", jobId);
  revalidatePath(`/jobs/${jobId}`);
}
