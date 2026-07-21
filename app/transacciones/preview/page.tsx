import { Suspense } from "react";
import { loadTransactionsCached } from "@/lib/transactions";
import { loadCategoriesCached } from "@/lib/categories";
import { getDateRange } from "@/lib/dateRange";
import PreviewList from "./PreviewList";

// ── Preview: nuevo estilo visual para Movimientos (mockup, no sustituye la real) ──

export default async function TransaccionesPreviewPage(props: {
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
  const allMonthKeys = [...new Set((allTransactions ?? transactions).map((t) => t.date.slice(0, 7)))]
    .sort()
    .reverse();

  return (
    <div className="max-w-md mx-auto bg-card min-h-screen">
      <div className="px-4 pt-6 pb-16">
        <Suspense fallback={null}>
          <PreviewList
            transactions={transactions}
            categories={categories}
            uncategorizedCount={uncategorizedCount}
            allMonthKeys={allMonthKeys}
          />
        </Suspense>
      </div>
    </div>
  );
}
