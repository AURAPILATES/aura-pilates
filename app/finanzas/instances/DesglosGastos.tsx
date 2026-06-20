import { ChartCard } from "@/components/charts";
import GastosBreakdown from "../GastosBreakdown";

type Category = {
  category: string;
  count: number;
  total: number;
  color: string;
  iconKey?: string;
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
}: {
  categories: Category[];
  transactionsByCategory: Record<string, Txn[]>;
  totalExpCat: number;
  rangeLabel?: string | null;
}) {
  return (
    <ChartCard
      title="Desglose gastos operativos"
      subtitle="Distribución de gastos por categoría en el período"
      dateRange={rangeLabel ?? undefined}
      dataSource="Exportación bancaria CaixaBank · excluye aportaciones de socios, préstamo e inversión inicial"
      sources={["excel"]}
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
