"use server";

import { revalidatePath } from "next/cache";
import { addJobForUser } from "@/lib/add-job";
import { supabaseServer } from "@/lib/supabase/server";

export type AddState = { ok: true; id: string; title: string } | { ok?: false; error: string } | null;

export async function addJobAction(_prev: AddState, form: FormData): Promise<AddState> {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "צריך להתחבר מחדש" };

  const url = String(form.get("url") ?? "").trim() || null;
  const text = String(form.get("text") ?? "").trim() || null;
  try {
    const r = await addJobForUser(user.id, url, text);
    revalidatePath("/");
    return { ok: true, id: r.id, title: r.title };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
