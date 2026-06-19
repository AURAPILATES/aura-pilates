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
  return `${parseInt(day)} ${MONTHS_SHORT[parseInt(m) - 1]}`;
}

function fmtEur(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
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

  const uncategorizedCount = transactions.filter((t) => !t.category).length;
  const recurringContacts  = detectRecurring(transactions);

  const latestBal = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null);

  const totalIn     = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut    = Math.abs(transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const incomeCount = transactions.filter((t) => t.amount > 0).length;
  const expenseCount = transactions.filter((t) => t.amount < 0).length;
  const neto        = totalIn - totalOut;
  const margin      = totalIn > 0 ? (neto / totalIn) * 100 : 0;

  return (
    <div>
      {/* ── Hero ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-5">
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-[11px] font-semibold text-navy/45 uppercase tracking-widest mb-2">Transacciones</p>
            {latestBal?.balance != null ? (
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className="text-3xl sm:text-[2.6rem] font-bold text-navy tabular-nums leading-none">
                  {fmtEur(latestBal.balance)}
                </span>
                <span className="text-sm text-navy/45">saldo · {fmtBalanceDate(latestBal.date)}</span>
              </div>
            ) : (
              <p className="text-3xl font-bold text-navy/30">—</p>
            )}
          </div>
          <Suspense fallback={null}><DateFilter /></Suspense>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-white border border-navy/[0.07] rounded-2xl px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success shrink-0">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
              <p className="text-[10px] sm:text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Ingresos</p>
            </div>
            <p className="text-lg sm:text-2xl font-semibold text-success tabular-nums">+{fmtEur(totalIn)}</p>
            <p className="text-[10px] sm:text-[11px] text-navy/40 mt-1">{incomeCount} movimientos</p>
          </div>

          <div className="bg-white border border-navy/[0.07] rounded-2xl px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-danger shrink-0">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>
              </svg>
              <p className="text-[10px] sm:text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Gastos</p>
            </div>
            <p className="text-lg sm:text-2xl font-semibold text-[#B85C3A] tabular-nums">−{fmtEur(totalOut)}</p>
            <p className="text-[10px] sm:text-[11px] text-navy/40 mt-1">
              {uncategorizedCount > 0 ? `${uncategorizedCount} sin etiquetar` : `${expenseCount} movimientos`}
            </p>
          </div>

          <div className="bg-white border border-navy/[0.07] rounded-2xl px-3 sm:px-4 py-3 sm:py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy/40 shrink-0">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
              <p className="text-[10px] sm:text-[11px] font-semibold text-navy/45 uppercase tracking-wider">Resultado neto</p>
            </div>
            <p className={`text-lg sm:text-2xl font-semibold tabular-nums ${neto >= 0 ? "text-navy" : "text-danger"}`}>
              {neto >= 0 ? "+" : "−"}{fmtEur(Math.abs(neto))}
            </p>
            <p className="text-[10px] sm:text-[11px] text-navy/40 mt-1">
              margen {margin.toFixed(1).replace(".", ",")}%
            </p>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-2 sm:px-6 pt-4 pb-16 max-w-6xl mx-auto">
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
