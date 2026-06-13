import { Suspense } from "react";
import { loadTransactions, type Transaction } from "@/lib/transactions";
import { loadCategories } from "@/lib/categories";
import { getDateRange } from "@/lib/dateRange";
import DateFilter from "@/app/components/DateFilter";
import TransaccionesList from "./TransaccionesList";

// ── Analysis helpers (server-side) ────────────────────────────────────────────

const OPERATIONAL_CATS = new Set([
  "Alquiler","Salarios","Electricidad","Agua","Software","Gestoría y legal",
  "Impuestos y tasas","Teléfono","Seguros","Comisiones bancarias","Merchandising",
  "Local",
  // "Otros" excluido: es un catch-all que siempre produce falsos positivos
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
    // Amounts within 30% of each other → likely same recurring charge
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const consistent = amounts.every((a) => avg > 0 && Math.abs(a - avg) / avg < 0.30);
    if (consistent) recurring.push(contact);
  }

  return recurring;
}

function detectAnomalies(transactions: Transaction[]): Anomaly[] {
  // Find months with expense data, sorted ascending
  const expMonths = [...new Set(
    transactions
      .filter((t) => t.amount < 0 && OPERATIONAL_CATS.has(t.category))
      .map((t) => t.date.slice(0, 7)),
  )].sort();

  if (expMonths.length < 2) return [];

  const currentMonth = expMonths[expMonths.length - 1];
  const prevMonths   = expMonths.slice(Math.max(0, expMonths.length - 4), expMonths.length - 1);
  if (prevMonths.length === 0) return [];

  // Sum per month per category
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
    const avgAmt  = withData.reduce((s, v) => s + v, 0) / withData.length;
    if (avgAmt === 0) continue;
    const deviation = (currentAmt - avgAmt) / avgAmt;
    if (Math.abs(deviation) > 0.25) {
      anomalies.push({ category: cat, currentAmount: currentAmt, avgAmount: avgAmt, deviationPct: deviation * 100, currentMonth });
    }
  }

  return anomalies.sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct));
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TransaccionesPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const { from, to, label: rangeLabel } = getDateRange(sp.range);

  const [transactions, categories] = await Promise.all([
    loadTransactions(from, to),
    loadCategories(),
  ]);

  const uncategorizedCount = transactions.filter((t) => t.category === "Otros").length;
  const recurringContacts  = detectRecurring(transactions);
  const anomalies          = detectAnomalies(transactions);

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-navy font-display">Transacciones</h1>
        <p className="text-sm text-navy/40 mt-1">
          {transactions.length} movimientos · {rangeLabel}
        </p>
      </div>
      <div className="mb-5">
        <Suspense fallback={null}>
          <DateFilter />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <TransaccionesList
          transactions={transactions}
          categories={categories}
          uncategorizedCount={uncategorizedCount}
          recurringContacts={recurringContacts}
          anomalies={anomalies}
        />
      </Suspense>
    </main>
  );
}
