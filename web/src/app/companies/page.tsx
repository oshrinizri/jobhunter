import { AddCompanyForm, CompanyRow, SuggestButton, SuggestionRow } from "./client";
import { EmptyState } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizeCompanyName } from "@/lib/text";
import type { CompanyCard } from "@/lib/types";

export default async function CompaniesPage() {
  const db = await supabaseServer();
  const [{ data: companies }, { data: cards }] = await Promise.all([
    db.from("companies").select("*").neq("status", "rejected").order("name"),
    db.from("company_cards").select("*"),
  ]);
  const cardOf = new Map((cards ?? []).map((c) => [c.company_name as string, c as CompanyCard]));

  const groups = [
    { key: "suggested", label: "הצעות להוספה", hint: "ה-AI מצא חברות שמתאימות לפרופיל שלך. מה שתאשר יתווסף לסריקה ויקבל דירוג." },
    { key: "active", label: "נסרקות", hint: null },
    { key: "paused", label: "מושהות", hint: null },
    { key: "blacklist", label: "רשימה שחורה", hint: null },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">חברות</h1>
      <AddCompanyForm />
      <SuggestButton />
      {!companies?.length && <EmptyState title="אין עדיין חברות" body="אפשר להוסיף חברה לפי שם, או לבקש הצעות מה-AI." />}
      {groups.map((g) => {
        const items = (companies ?? []).filter((c) => c.status === g.key);
        if (!items.length) return null;
        return (
          <section key={g.key}>
            <h2 className="mb-1 text-sm font-semibold text-muted">
              {g.label} ({items.length})
            </h2>
            {g.hint && <p className="mb-2 text-xs text-muted">{g.hint}</p>}
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {items.map((c) =>
                g.key === "suggested" ? (
                  <SuggestionRow key={c.id} company={c} />
                ) : (
                  <CompanyRow key={c.id} company={c} card={cardOf.get(normalizeCompanyName(c.name)) ?? null} />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
