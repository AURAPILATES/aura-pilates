import { Suspense } from "react";
import { loadTransactionsCached } from "@/lib/transactions";
import { loadCategoriesCached } from "@/lib/categories";
import { loadRecurringExpensesCached } from "@/lib/recurringExpenses";
import { findRecurringSeries, projectNextDate } from "@/lib/recurring";
import GastosRecurrentesList, { type ConfirmedExpenseRow, type PendingSeriesRow } from "./GastosRecurrentesList";
import MobileNav from "@/app/components/MobileNav";

export default async function GastosRecurrentesPage() {
  const [transactions, categories, expenses] = await Promise.all([
    loadTransactionsCached(null, null),
    loadCategoriesCached(),
    loadRecurringExpensesCached(),
  ]);

  const series = findRecurringSeries(transactions, categories);
  const seriesByKey = new Map(series.map((s) => [s.key, s]));
  const expenseByKey = new Map(expenses.map((e) => [e.key, e]));

  // Filtra gastos ya confirmados/ignorados antes de este fix cuya categoría sea de
  // ingreso (p. ej. "Ingresos Stripe"), para que no sigan apareciendo aunque ya
  // estuvieran guardados en recurring_expenses.
  const nonOperationalLabels = new Set(
    categories.filter((c) => c.group_type !== "operational").map((c) => c.label),
  );
  const isExpenseRow = (e: { category: string | null }) =>
    !e.category || !nonOperationalLabels.has(e.category);

  const pending: PendingSeriesRow[] = series
    .filter((s) => !expenseByKey.has(s.key))
    .map((s) => ({
      key: s.key,
      label: s.label,
      category: s.category,
      period: s.period,
      periodDays: s.periodDays,
      amount: s.amount,
      occurrences: s.transactions.length,
      lastDate: s.transactions[s.transactions.length - 1].date,
    }));

  const confirmed: ConfirmedExpenseRow[] = expenses
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

  const archived = expenses.filter((e) => e.status !== "confirmed" && isExpenseRow(e));

  return (
    <div>
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MobileNav />
            <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Gastos recurrentes</h1>
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-6 pt-[11px] sm:pt-4 pb-16 max-w-6xl mx-auto">
        <Suspense fallback={null}>
          <GastosRecurrentesList
            pending={pending}
            confirmed={confirmed}
            archived={archived}
            categories={categories}
          />
        </Suspense>
      </div>
    </div>
  );
}
