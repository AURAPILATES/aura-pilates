import { Suspense } from "react";
import { loadTransactionsCached } from "@/lib/transactions";
import { loadCategoriesCached } from "@/lib/categories";
import { getDateRange } from "@/lib/dateRange";
import { computePendingRecurring, detectRecurringTransactions, findRecurringSeries, projectNextDate, seriesKeyFor } from "@/lib/recurring";
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

  // El heurístico de arriba solo detecta series con 2+ pagos ya importados y separación
  // regular; un gasto confirmado a mano (createRecurringExpenseFromTransaction) puede no
  // cumplir eso (p. ej. un único pago hasta ahora) y aun así debe verse como recurrente en
  // el icono/filtro de Movimientos, no solo en la pestaña "Recurrentes".
  const confirmedPeriodByKey = new Map(
    expenses.filter((e) => e.status === "confirmed").map((e) => [e.key, e.period]),
  );
  // IDs de movimientos cuya serie ya está confirmada como gasto/ingreso recurrente (checkbox
  // marcado en el drawer) - a diferencia de recurringPeriods, que también incluye series
  // detectadas solo por heurística y todavía sin confirmar. Sirve para que el icono de la
  // tabla distinga visualmente "confirmado" de "parece recurrente, pero sin confirmar".
  const recurringConfirmedIds = new Set<string>();
  for (const t of transactions) {
    const key = seriesKeyFor(t, allTimeTransactions);
    const period = key ? confirmedPeriodByKey.get(key) : undefined;
    if (period) {
      recurringPeriods[t.id] ??= period;
      recurringConfirmedIds.add(t.id);
    }
  }

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
      const lastDate = s ? s.transactions[s.transactions.length - 1].date : e.anchor_date;
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

  // 'deleted' se queda fuera a propósito: existe solo para que el heurístico no vuelva a
  // proponer la serie como pendiente (ver deleteRecurringExpense en recurringActions.ts), no
  // para mostrarse en ningún sitio.
  const archivedRecurring = expenses.filter((e) => e.status !== "confirmed" && e.status !== "deleted" && isExpenseRow(e));

  return (
    <div>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm sm:rounded-t-[14px]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MobileNav />
            <h1 className="text-[26px] font-bold text-navy">Transacciones</h1>
          </div>
          <div id="header-actions" className="flex items-center gap-2 shrink-0" />
        </div>
        <div id="header-tabs" />
      </div>

      {/* ── Content ── */}
      <div className="px-2 sm:px-6 pt-1.5 pb-16 max-w-[1600px] mx-auto">
        <Suspense fallback={null}>
          <TransaccionesTabs
            transactions={transactions}
            allTransactions={allTimeTransactions}
            categories={categories}
            uncategorizedCount={uncategorizedCount}
            recurringPeriods={recurringPeriods}
            recurringConfirmedIds={recurringConfirmedIds}
            recurringExpenses={expenses}
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
