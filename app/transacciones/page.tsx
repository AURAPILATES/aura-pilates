import { Suspense } from "react";
import { loadTransactions, type Transaction } from "@/lib/transactions";
import { loadCategories } from "@/lib/categories";
import { getDateRange } from "@/lib/dateRange";
import TransaccionesList from "./TransaccionesList";
import ImportButton from "./ImportButton";

// ── Analysis helpers ───────────────────────────────────────────────────────────

const OPERATIONAL_CATS = new Set([
  "Alquiler","Salarios","Electricidad","Agua","Software","Gestoría y legal",
  "Impuestos y tasas","Teléfono","Seguros","Comisiones bancarias","Merchandising","Local",
]);

export type Anomaly = {
  category: string;
  currentAmount: number;
  avgAmount: number;
  deviationPct: number;
  currentMonth: string;
};

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

function detectAnomalies(transactions: Transaction[]): Anomaly[] {
  const expMonths = [...new Set(
    transactions
      .filter((t) => t.amount < 0 && OPERATIONAL_CATS.has(t.category))
      .map((t) => t.date.slice(0, 7)),
  )].sort();
  if (expMonths.length < 2) return [];
  const currentMonth = expMonths[expMonths.length - 1];
  const prevMonths   = expMonths.slice(Math.max(0, expMonths.length - 4), expMonths.length - 1);
  if (prevMonths.length === 0) return [];
  const byMonthCat = new Map<string, Map<string, number>>();
  for (const t of transactions) {
    if (t.amount >= 0 || !OPERATIONAL_CATS.has(t.category)) continue;
    const m = t.date.slice(0, 7);
    if (m !== currentMonth && !prevMonths.includes(m)) continue;
    if (!byMonthCat.has(m)) byMonthCat.set(m, new Map());
    const row = byMonthCat.get(m)!;
    row.set(t.category, (row.get(t.category) ?? 0) + Math.abs(t.amount));
  }
  const anomalies: Anomaly[] = [];
  const currentCats = byMonthCat.get(currentMonth) ?? new Map();
  for (const [cat, currentAmt] of currentCats) {
    const prevTotals = prevMonths.map((m) => byMonthCat.get(m)?.get(cat) ?? 0);
    const withData   = prevTotals.filter((v) => v > 0);
    if (withData.length === 0) continue;
    const avgAmt = withData.reduce((s, v) => s + v, 0) / withData.length;
    if (avgAmt === 0) continue;
    const deviation = (currentAmt - avgAmt) / avgAmt;
    if (Math.abs(deviation) > 0.25) {
      anomalies.push({ category: cat, currentAmount: currentAmt, avgAmount: avgAmt, deviationPct: deviation * 100, currentMonth });
    }
  }
  return anomalies.sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct));
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
  const { from, to, label: rangeLabel } = isCustom
    ? {
        from: sp.from ?? null,
        to:   sp.to   ?? null,
        label: [sp.from, sp.to].filter(Boolean).join(" → ") || "Personalizado",
      }
    : getDateRange(sp.range);

  const [transactions, categories] = await Promise.all([
    loadTransactions(from, to),
    loadCategories(),
  ]);

  const uncategorizedCount = transactions.filter((t) => t.category === "Otros").length;
  const recurringContacts  = detectRecurring(transactions);
  const anomalies          = detectAnomalies(transactions);

  const latestBal = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null);

  return (
    <main className="px-2 sm:px-6 pt-6 sm:pt-8 pb-16 max-w-7xl mx-auto">

      {/* ── Mobile header ── */}
      <div className="sm:hidden mb-5">
        <h1 className="text-3xl font-bold text-navy font-display">Transacciones</h1>
        <p className="text-sm text-navy/55 mt-1 mb-4">
          {transactions.length} movimientos · {rangeLabel}
        </p>
        {latestBal?.balance != null && (
          <div className="bg-navy rounded-2xl px-5 py-4 mb-3">
            <p className="text-[11px] text-white/45 uppercase tracking-wider mb-1">
              Saldo a {fmtBalanceDate(latestBal.date)}
            </p>
            <p className="text-3xl font-bold text-white tabular-nums">
              {latestBal.balance.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
          </div>
        )}
      </div>

      {/* ── Desktop header ── */}
      <div className="hidden sm:flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-navy font-display">Transacciones</h1>
          <p className="text-sm text-navy/55 mt-1.5">
            {transactions.length} movimientos · {rangeLabel}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {latestBal?.balance != null && (
            <div className="text-right">
              <p className="text-[11px] text-navy/45 uppercase tracking-wider mb-1">
                Saldo a {fmtBalanceDate(latestBal.date)}
              </p>
              <p className="text-2xl font-bold text-navy tabular-nums">
                {latestBal.balance.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </p>
            </div>
          )}
          <ImportButton />
        </div>
      </div>

      <Suspense fallback={null}>
        <TransaccionesList
          transactions={transactions}
          categories={categories}
          uncategorizedCount={uncategorizedCount}
          recurringContacts={recurringContacts}
          anomalies={anomalies}
          currentRange={sp.range ?? "all"}
          customFrom={sp.from}
          customTo={sp.to}
        />
      </Suspense>
    </main>
  );
}
