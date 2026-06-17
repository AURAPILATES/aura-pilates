import { Suspense } from "react";
import { loadTransactionsCached, type Transaction } from "@/lib/transactions";
import { loadCategoriesCached } from "@/lib/categories";
import { getDateRange } from "@/lib/dateRange";
import TransaccionesList from "./TransaccionesList";
import DateFilter from "@/app/components/DateFilter";

// ── Analysis helpers ───────────────────────────────────────────────────────────

function detectRecurring(transactions: Transaction[]): string[] {
  const byContact = new Map<string, { months: Set<string>; amounts: number[] }>();
  for (const t of transactions) {
    if (t.amount >= 0 || !t.contact) continue;
    const key = t.contact.toLowerCase().trim();
    if (!byContact.has(key)) byContact.set(key, { months: new Set(), amounts: [] });
    const entry = byContact.get(key)!;
    entry.months.add(t.date.slice(0, 7));
    entry.amounts.push(Math.abs(t.amount));
  }
  const recurring: string[] = [];
  for (const [contact, { months, amounts }] of byContact) {
    if (months.size < 2) continue;
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const consistent = amounts.every((a) => avg > 0 && Math.abs(a - avg) / avg < 0.30);
    if (consistent) recurring.push(contact);
  }
  return recurring;
}

const MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

function fmtBalanceDate(d: string) {
  const [, m, day] = d.split("-");
  return `${parseInt(day)} ${MONTHS_SHORT[parseInt(m) - 1].toUpperCase()}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TransaccionesPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const isCustom = sp.range === "custom" && (sp.from || sp.to);
  const { from, to } = isCustom
    ? { from: sp.from ?? null, to: sp.to ?? null }
    : getDateRange(sp.range);

  const [transactions, categories] = await Promise.all([
    loadTransactionsCached(from, to),
    loadCategoriesCached(),
  ]);

  const uncategorizedCount = transactions.filter((t) => t.category === "Otros").length;
  const recurringContacts  = detectRecurring(transactions);

  const latestBal = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null);

  return (
    <div>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Transacciones</h1>
            {latestBal?.balance != null && (
              <div className="hidden sm:flex items-baseline gap-2">
                <span className="text-xs text-navy/45">Saldo · {fmtBalanceDate(latestBal.date)}</span>
                <span className="text-sm font-bold text-navy tabular-nums">
                  {latestBal.balance.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>
            )}
          </div>
          <Suspense fallback={null}><DateFilter /></Suspense>
        </div>
      </div>

      {/* ── Saldo (móvil) ── */}
      {latestBal?.balance != null && (
        <div className="sm:hidden px-4 pt-4 flex items-baseline justify-between max-w-6xl mx-auto">
          <span className="text-xs text-navy/45">Saldo · {fmtBalanceDate(latestBal.date)}</span>
          <span className="text-sm font-bold text-navy tabular-nums">
            {latestBal.balance.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
        </div>
      )}

      {/* ── Content ── */}
      <div className="px-2 sm:px-6 pt-6 sm:pt-8 pb-16 max-w-6xl mx-auto">
        <Suspense fallback={null}>
          <TransaccionesList
            transactions={transactions}
            categories={categories}
            uncategorizedCount={uncategorizedCount}
            recurringContacts={recurringContacts}
          />
        </Suspense>
      </div>
    </div>
  );
}
