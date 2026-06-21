import { Suspense } from "react";
import { loadTransactionsCached } from "@/lib/transactions";
import { loadCategoriesCached } from "@/lib/categories";
import { getDateRange } from "@/lib/dateRange";
import { detectRecurringTransactions } from "@/lib/recurring";
import TransaccionesList from "./TransaccionesList";
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

  const [transactions, categories] = await Promise.all([
    loadTransactionsCached(from, to),
    loadCategoriesCached(),
  ]);

  const uncategorizedCount = transactions.filter((t) => !t.category).length;
  const recurringPeriods   = Object.fromEntries(detectRecurringTransactions(transactions));

  return (
    <div>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MobileNav />
            <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Movimientos</h1>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-2 sm:px-6 pt-1.5 sm:pt-4 pb-16 max-w-6xl mx-auto">
        <Suspense fallback={null}>
          <TransaccionesList
            transactions={transactions}
            categories={categories}
            uncategorizedCount={uncategorizedCount}
            recurringPeriods={recurringPeriods}
          />
        </Suspense>
      </div>
    </div>
  );
}
