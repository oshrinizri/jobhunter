import { AddCompanyForm, CompanyRow } from "./client";
import { EmptyState } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";

export default async function CompaniesPage() {
  const db = await supabaseServer();
  const [{ data: companies }, { data: cards }] = await Promise.all([
    db.from("companies").select("*").order("status").order("name"),
    db.from("company_cards").select("company_name,tier"),
  ]);
  const tierOf = new Map((cards ?? []).map((c) => [c.company_name, c.tier as string]));

  const groups = [
    { key: "active", label: "נסרקות" },
    { key: "suggested", label: "הצעות להוספה" },
    { key: "paused", label: "מושהות" },
    { key: "blacklist", label: "רשימה שחורה" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">חברות</h1>
      <AddCompanyForm />
      {!companies?.length && <EmptyState title="אין עדיין חברות" body="הרשימה הראשונית תיווצר בהקמה." />}
      {groups.map((g) => {
        const items = (companies ?? []).filter((c) => c.status === g.key);
        if (!items.length) return null;
        return (
          <section key={g.key}>
            <h2 className="mb-2 text-sm font-semibold text-muted">
              {g.label} ({items.length})
            </h2>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {items.map((c) => (
                <CompanyRow key={c.id} company={c} aiTier={tierOf.get(c.name.trim().toLowerCase()) ?? null} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
