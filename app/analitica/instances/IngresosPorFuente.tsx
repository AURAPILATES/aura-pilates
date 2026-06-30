"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import { ChartCard, ChartTypeToggle } from "@/components/charts";
import type { IngresosPorFuenteRow } from "./IngresosPorFuenteBody";

const USC_PRICE_STUDIO = 20;  // precio tarifa Aura por clase suelta
const USC_PRICE_PAID   = 11;  // lo que Urban paga a Aura por clase (ya es neto)

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

  // El CSV de Momence ya registra lo que paga Urban (11 €/clase = neto para Aura)
  const uscNet   = uscGross;
  const totalNet = stripeNet + uscNet;

  const SOURCES = [
    { key: "stripe", label: "Stripe", color: "#4021c8", value: stripeNet },
    { key: "urban",  label: "Urban",  color: "#F59E0B", value: uscNet },
  ];

  return (
    <ChartCard
      title="Ingresos por fuente"
      subtitle="Importe neto (sin comisiones) por canal de venta"
      dateRange={dateRange}
      kpiItems={[
        {
          label: "Ventas totales",
          value: fmtEur(totalNet),
          helper: "Stripe neto + Urban",
        },
        {
          label: "Ventas Stripe",
          value: fmtEur(stripeNet),
          helper: `Bruto: ${fmtEur(stripeGross)} · comis. ${fmtEur(stripeFees)}`,
        },
        {
          label: "Ventas Urban",
          value: fmtEur(uscNet),
          helper: `${USC_PRICE_PAID} €/clase · tarifa estudio ${USC_PRICE_STUDIO} €`,
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
        </div>
      }
      dataSource="Stripe API (pagos netos) + Urban Sports Club Momence CSV (11 €/clase, ya neto)"
      sources={["stripe", "momence"]}
      lastUpdated={lastUpdated}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 min-w-0">
          <IngresosPorFuenteBody data={monthly} chartType={chartType} />
        </div>
        <div className="lg:col-span-1 min-w-0">
          <p className="text-xs font-medium text-navy/55 mb-2.5">Resumen</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-navy/5 mb-4">
            {SOURCES.map((s) => (
              <div
                key={s.key}
                style={{ flex: `${totalNet > 0 ? s.value / totalNet : 0} 0 0%`, backgroundColor: s.color }}
              />
            ))}
          </div>
          <div className="space-y-2.5">
            {SOURCES.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-navy/70 truncate">{s.label}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold text-navy tabular-nums">{fmtEur(s.value)}</span>
                  <span className="text-[11px] text-navy/40 ml-1">{totalNet > 0 ? `${Math.round(s.value / totalNet * 100)}%` : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr className="border-b border-navy/[0.07]">
              <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Mes</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Stripe bruto</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Comis. Stripe</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Stripe neto</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Urban</th>
              <th className="text-right py-2 text-navy/45 font-semibold uppercase tracking-wide">Total neto</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((row) => (
              <tr key={row.month} className="border-b border-navy/[0.04]">
                <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">{row.label}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{row.stripeGross > 0 ? fmtEur(row.stripeGross) : "-"}</td>
                <td className="py-2 pr-3 text-right text-danger tabular-nums">{row.stripeFees > 0 ? `−${fmtEur(row.stripeFees)}` : "-"}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{row.stripeNet > 0 ? fmtEur(row.stripeNet) : "-"}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{row.uscNet > 0 ? fmtEur(row.uscNet) : "-"}</td>
                <td className="py-2 text-right text-navy font-medium tabular-nums">{fmtEur(row.stripeNet + row.uscNet)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-navy/[0.07] bg-navy/[0.025]">
              <td className="py-2 pr-3 text-navy/55 font-semibold">Total</td>
              <td className="py-2 pr-3 text-right text-navy font-semibold tabular-nums">{fmtEur(stripeGross)}</td>
              <td className="py-2 pr-3 text-right text-danger font-semibold tabular-nums">−{fmtEur(stripeFees)}</td>
              <td className="py-2 pr-3 text-right text-navy font-semibold tabular-nums">{fmtEur(stripeNet)}</td>
              <td className="py-2 pr-3 text-right text-navy font-semibold tabular-nums">{fmtEur(uscGross)}</td>
              <td className="py-2 text-right text-navy font-semibold tabular-nums">{fmtEur(totalNet)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </ChartCard>
  );
}
