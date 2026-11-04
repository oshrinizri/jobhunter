// Endpoint for the iOS Shortcut "הוסף ל-JobHunter".
// POST { url?: string, text?: string } with header  Authorization: Bearer <ingest_token>
import { NextResponse, type NextRequest } from "next/server";
import { addJobForUser } from "@/lib/add-job";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length < 32) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: pref } = await supabaseAdmin().from("preferences").select("user_id").eq("ingest_token", token).maybeSingle();
  if (!pref) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  // The share sheet sometimes passes text that merely contains the link.
  const rawUrl: string | null = body.url ?? body.text?.match(/https?:\/\/\S+/)?.[0] ?? null;
  const text: string | null = body.url ? null : (body.text ?? null);

  try {
    const r = await addJobForUser(pref.user_id, rawUrl, rawUrl ? null : text);
    return NextResponse.json({ ok: true, message: `נוספה: ${r.title} @ ${r.company}` });
  } catch (e) {
    return NextResponse.json({ ok: false, message: (e as Error).message }, { status: 422 });
  }
}
