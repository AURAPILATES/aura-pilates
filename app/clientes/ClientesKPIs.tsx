"use client";

import { fmt } from "@/lib/analytics";
import KpiTile from "@/components/charts/KpiTile";

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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
      <KpiTile
        label="Volumen bruto"
        dateRange={dateRange}
        value={fmt(grossRevenue)}
        delta={{ cur: grossRevenue, prev: grossRevenueComp }}
        compLabel={`${compDateRange} · ${fmt(grossRevenueComp)}`}
      />
      <KpiTile
        label="MRR estimado"
        dateRange={range90}
        value={fmt(mrr)}
        sub="media 3 meses"
        valueClassName="text-success"
      />
    </div>
  );
}
