"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import { ChartCard, ChartTypeToggle, Legend } from "@/components/charts";
import type { IngresosPorFuenteRow } from "./IngresosPorFuenteBody";

const USC_COMMISSION = 0.45;

const IngresosPorFuenteBody = dynamic(() => import("./IngresosPorFuenteBody"), {
  ssr: false,
  loading: () => <div className="h-[240px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

function fmtEur(v: number) {
  return Math.round(v).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

export default function IngresosPorFuente({
  stripeGross,
  stripeFees,
  stripeNet,
  uscGross,
  monthly,
  dateRange,
  lastUpdated,
}: {
  stripeGross: number;
  stripeFees: number;
  stripeNet: number;
  uscGross: number;
  monthly: IngresosPorFuenteRow[];
  dateRange?: string;
  lastUpdated?: string | null;
}) {
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const uscNet   = uscGross * (1 - USC_COMMISSION);
  const totalNet = stripeNet + uscNet;

  return (
    <ChartCard
      title="Ingresos por fuente"
      subtitle="Importe neto (sin comisiones) por canal de venta"
      dateRange={dateRange}
      kpiItems={[
        {
          label: "Ventas totales",
          value: fmtEur(totalNet),
          helper: `Stripe + Urban · neto`,
        },
        {
          label: "Ventas Stripe",
          value: fmtEur(stripeNet),
          helper: `Bruto: ${fmtEur(stripeGross)} · comis. ${fmtEur(stripeFees)}`,
        },
        {
          label: "Ventas Urban",
          value: fmtEur(uscNet),
          helper: `Bruto: ${fmtEur(uscGross)} · comis. ${USC_COMMISSION * 100}%`,
        },
      ]}
      toolbar={
        <div className="flex items-center gap-3 w-full">
          <ChartTypeToggle
            value={chartType}
            onChange={(v) => setChartType(v as "bar" | "line")}
            options={[
              { value: "bar",  label: "Ver como barras", icon: <BarChart2 size={14} /> },
              { value: "line", label: "Ver como línea",  icon: <Activity  size={14} /> },
            ]}
          />
          <Legend
            items={[
              { label: "Stripe", color: "#4021c8" },
              { label: "Urban",  color: "#F59E0B" },
            ]}
          />
        </div>
      }
      dataSource="Stripe API (pagos netos) + Urban Sports Club CSV (bruto × 55% neto)"
      sources={["stripe", "momence"]}
      lastUpdated={lastUpdated}
    >
      <IngresosPorFuenteBody data={monthly} chartType={chartType} />

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr className="border-b border-navy/[0.07]">
              <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Mes</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Stripe neto</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Urban neto</th>
              <th className="text-right py-2 text-navy/45 font-semibold uppercase tracking-wide">Total</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((row) => (
              <tr key={row.month} className="border-b border-navy/[0.04] last:border-0">
                <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">{row.label}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{row.stripeNet > 0 ? fmtEur(row.stripeNet) : "-"}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{row.uscNet   > 0 ? fmtEur(row.uscNet)   : "-"}</td>
                <td className="py-2 text-right text-navy font-medium tabular-nums">{fmtEur(row.stripeNet + row.uscNet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
