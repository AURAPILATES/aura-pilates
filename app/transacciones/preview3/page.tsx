import { Suspense } from "react";
import { loadTransactionsCached } from "@/lib/transactions";
import { loadCategoriesCached } from "@/lib/categories";
import { getDateRange } from "@/lib/dateRange";
import { detectRecurringTransactions } from "@/lib/recurring";
import DesktopList from "./DesktopList";
import MobileNav from "@/app/components/MobileNav";

// ── Preview 3: rediseño de Movimientos para desktop, misma identidad visual que mobile ──

export default async function TransaccionesPreview3Page(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const isCustom = sp.range === "custom" && (sp.from || sp.to);
  const { from, to } = isCustom
    ? { from: sp.from ?? null, to: sp.to ?? null }
    : getDateRange(sp.range);

  const [transactions, categories, allTransactions] = await Promise.all([
    loadTransactionsCached(from, to),
    loadCategoriesCached(),
    isCustom || sp.range ? loadTransactionsCached(null, null) : Promise.resolve(null),
  ]);

  const uncategorizedCount = transactions.filter((t) => !t.category).length;
  const recurringPeriods   = Object.fromEntries(detectRecurringTransactions(transactions));
  const allMonthKeys = [...new Set((allTransactions ?? transactions).map((t) => t.date.slice(0, 7)))]
    .sort()
    .reverse();

  return (
    <div>
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MobileNav />
            <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Movimientos · Propuesta desktop</h1>
          </div>
        </div>
      </div>

      <div className="px-2 sm:px-6 pt-[11px] sm:pt-4 pb-16 max-w-6xl mx-auto">
        <Suspense fallback={null}>
          <DesktopList
            transactions={transactions}
            categories={categories}
            uncategorizedCount={uncategorizedCount}
            recurringPeriods={recurringPeriods}
            allMonthKeys={allMonthKeys}
          />
        </Suspense>
      </div>
    </div>
  );
}
