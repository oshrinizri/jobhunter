import Link from "next/link";
import { AddItem, Interview, ProfileItemRow, RescoreButton } from "./client";
import { Card } from "@/components/ui";
import { KIND_LABELS, PROFILE_KINDS, type ProfileItem } from "@/lib/profile-seed";
import { supabaseServer } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const db = await supabaseServer();
  const [{ data: items }, { data: questions }] = await Promise.all([
    db.from("master_profile_items").select("*").order("start_date", { ascending: false, nullsFirst: true }).order("sort_order"),
    db.from("profile_questions").select("id,question,why").eq("status", "open").order("created_at"),
  ]);
  const all = (items ?? []) as (ProfileItem & { id: string })[];

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">פרופיל וקורות חיים</h1>
        <span className="text-sm text-muted">{all.length} פריטים</span>
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold">📄 קורות החיים שלך</h2>
        <p className="text-sm text-muted">נבנים אוטומטית מהפרופיל: בלי להמציא, רק לסדר ולנסח. אפשר להוריד כ-PDF.</p>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/cv/he" className="rounded-xl bg-accent py-2.5 text-center font-semibold text-white">
            קו״ח בעברית
          </Link>
          <Link href="/cv/en" className="rounded-xl border border-accent py-2.5 text-center font-semibold text-accent">
            CV in English
          </Link>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">🎤 ראיון העשרה</h2>
        <p className="text-sm text-muted">
          ה-AI שואל שאלות קצרות על מספרים, כלים ופרויקטים, ומוסיף את התשובות לפרופיל. כך גם הציונים וגם קורות החיים משתפרים.
        </p>
        <Interview questions={questions ?? []} />
      </Card>

      <div className="space-y-4">
        {PROFILE_KINDS.map((k) => {
          const group = all.filter((i) => i.kind === k);
          if (!group.length) return null;
          return (
            <section key={k}>
              <h2 className="mb-2 text-sm font-semibold text-muted">{KIND_LABELS[k]}</h2>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {group.map((i) => (
                  <ProfileItemRow key={i.id} item={i} />
                ))}
              </div>
            </section>
          );
        })}
        <AddItem />
        <RescoreButton />
      </div>
    </div>
  );
}
