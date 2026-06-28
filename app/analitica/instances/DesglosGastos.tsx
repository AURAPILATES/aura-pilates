import type { EconomicGroup } from "@/lib/transactions";
import { ChartCard } from "@/components/charts";
import GastosBreakdown from "../GastosBreakdown";

type LeafCategory = { value: string; label: string; count: number; total: number; color: string; iconKey?: string };
type TopCategory = {
  key: string;
  label: string;
  count: number;
  total: number;
  group: EconomicGroup;
  color: string;
  iconKey?: string;
  children: LeafCategory[];
};

type Txn = {
  date: string;
  amount: number;
  concept: string;
  contact: string;
};

export default function DesglosGastos({
  categories,
  transactionsByCategory,
  totalExpCat,
  rangeLabel,
  lastUpdated,
}: {
  categories: TopCategory[];
  transactionsByCategory: Record<string, Txn[]>;
  totalExpCat: number;
  rangeLabel?: string | null;
  lastUpdated?: string | null;
}) {
  return (
    <ChartCard
      title="Desglose de gastos: personal y operativo"
      subtitle="Gasto de personal y operativo (OpEx) por categoría y subcategoría, sin inversión (CapEx)"
      dateRange={rangeLabel ?? undefined}
      dataSource="Exportación bancaria CaixaBank · excluye aportaciones de socios y préstamo"
      sources={["excel"]}
      lastUpdated={lastUpdated}
    >
      <GastosBreakdown
        categories={categories}
        transactionsByCategory={transactionsByCategory}
        totalExpCat={totalExpCat}
        rangeLabel={rangeLabel}
      />
    </ChartCard>
  );
}
