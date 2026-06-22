"use client";

import { fmt } from "@/lib/analytics";
import { ChartCard } from "@/components/charts";

const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function fmtD(d: string): string {
  const [y, m, day] = d.split("-");
  return `${parseInt(day)} ${MONTHS_ES[parseInt(m) - 1]} ${y}`;
}

type Props = {
  mrr: number;
  periodFrom: string;
  periodTo: string;
  compDateRange: string;
  grossRevenue: number;
  grossRevenueComp: number;
};

export default function ClientesKPIs({ mrr, periodFrom, periodTo, compDateRange, grossRevenue, grossRevenueComp }: Props) {
  const dateRange = `${fmtD(periodFrom)} – ${fmtD(periodTo)}`;
  const now = new Date();
  const d90ago = new Date(now); d90ago.setDate(d90ago.getDate() - 90);
  const range90 = `${fmtD(d90ago.toISOString().split("T")[0])} – ${fmtD(now.toISOString().split("T")[0])}`;

  return (
    <ChartCard
      title="Ingresos"
      dateRange={dateRange}
      kpiItems={[
        {
          label: "Volumen bruto",
          value: fmt(grossRevenue),
          helper: `vs ${fmt(grossRevenueComp)} (${compDateRange})`,
        },
        {
          label: "MRR estimado",
          value: fmt(mrr),
          valueClassName: "text-success",
          helper: `media 3 meses · ${range90}`,
        },
      ]}
      dataSource="Stripe en vivo"
      sources={["stripe"]}
      className="mb-6"
    />
  );
}
