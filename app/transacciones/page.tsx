import { Suspense } from "react";
import { loadTransactionsCached } from "@/lib/transactions";
import { loadCategoriesCached } from "@/lib/categories";
import { getDateRange } from "@/lib/dateRange";
import { computePendingRecurring, detectRecurringTransactions, findRecurringSeries, projectNextDate } from "@/lib/recurring";
import { loadRecurringExpensesCached } from "@/lib/recurringExpenses";
import { getContacts } from "./actions";
import TransaccionesTabs from "./TransaccionesTabs";
import type { ConfirmedExpenseRow, PendingSeriesRow } from "./RecurrentesList";
import MobileNav from "@/app/components/MobileNav";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TransaccionesPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const isCustom = sp.range === "custom" && (sp.from || sp.to);
  const { from, to } = isCustom
    ? { from: sp.from ?? null, to: sp.to ?? null }
    : getDateRange(sp.range);

  const [transactions, categories, allTimeTransactions, contacts, expenses] = await Promise.all([
    loadTransactionsCached(from, to),
    loadCategoriesCached(),
    loadTransactionsCached(null, null),
    getContacts(),
    loadRecurringExpensesCached(),
  ]);

  const uncategorizedCount = transactions.filter((t) => !t.category).length;
  const recurringPeriods   = Object.fromEntries(detectRecurringTransactions(transactions, categories));
  const allMonthKeys = [...new Set(allTimeTransactions.map((t) => t.date.slice(0, 7)))]
    .sort()
    .reverse();

  // ── Recurrentes ──
  const series = findRecurringSeries(allTimeTransactions, categories);
  const seriesByKey = new Map(series.map((s) => [s.key, s]));

  // Filtra gastos ya confirmados/ignorados antes de este fix cuya categoría sea de
  // ingreso (p. ej. "Ingresos Stripe"), para que no sigan apareciendo aunque ya
  // estuvieran guardados en recurring_expenses.
  const nonOperationalLabels = new Set(
    categories.filter((c) => c.group_type !== "operational").map((c) => c.label),
  );
  const isExpenseRow = (e: { category: string | null }) =>
    !e.category || !nonOperationalLabels.has(e.category);

  const pendingRecurring: PendingSeriesRow[] = computePendingRecurring(allTimeTransactions, categories, expenses, contacts);

  const confirmedRecurring: ConfirmedExpenseRow[] = expenses
    .filter((e) => e.status === "confirmed" && isExpenseRow(e))
    .map((e) => {
      const s = seriesByKey.get(e.key);
      const lastDate = s ? s.transactions[s.transactions.length - 1].date : null;
      const projection = lastDate ? projectNextDate(lastDate, e.period_days) : null;
      return {
        expense: e,
        lastDate,
        occurrences: s?.transactions.length ?? 0,
        nextDate: projection?.nextDate ?? null,
        daysUntil: projection?.daysUntil ?? null,
      };
    })
    .sort((a, b) => (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity));

  const archivedRecurring = expenses.filter((e) => e.status !== "confirmed" && isExpenseRow(e));

  return (
    <div>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-5 h-[45px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MobileNav />
            <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Transacciones</h1>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-2 sm:px-5 pt-7 sm:pt-10 pb-16 max-w-[1600px] mx-auto">
        <Suspense fallback={null}>
          <TransaccionesTabs
            transactions={transactions}
            categories={categories}
            uncategorizedCount={uncategorizedCount}
            recurringPeriods={recurringPeriods}
            recurringExpenses={expenses}
            allMonthKeys={allMonthKeys}
            contacts={contacts}
            pendingRecurring={pendingRecurring}
            confirmedRecurring={confirmedRecurring}
            archivedRecurring={archivedRecurring}
          />
        </Suspense>
      </div>
    </div>
  );
}
