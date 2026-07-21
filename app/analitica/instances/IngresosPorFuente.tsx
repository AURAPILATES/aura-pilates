"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import { ChartCard, ChartTypeToggle, ToggleGroup, CollapsibleTable, InteractiveLegend } from "@/components/charts";
import type { IngresosPorFuenteRow } from "./IngresosPorFuenteBody";

const USC_PRICE_STUDIO = 20;  // precio tarifa Aura por clase suelta
const USC_PRICE_PAID   = 11;  // lo que Urban paga a Aura por clase (ya es neto)

const IngresosPorFuenteBody = dynamic(() => import("./IngresosPorFuenteBody"), {
  ssr: false,
  loading: () => <div className="h-[240px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

type Period = "mes" | "trimestre" | "año";

const PERIODS: { key: Period; label: string }[] = [
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año", label: "Año" },
];

function fmtEur(v: number) {
  return Math.round(v).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

/** El histórico llega agregado por mes; para trimestre/año se vuelve a agrupar sumando los
 * meses que caen en cada bloque, en vez de pedir los datos ya agregados así al servidor. */
function groupByPeriod(rows: IngresosPorFuenteRow[], period: Period): IngresosPorFuenteRow[] {
  if (period === "mes") return rows;
  const map = new Map<string, IngresosPorFuenteRow>();
  for (const r of rows) {
    const [y, m] = r.month.split("-");
    const key = period === "año" ? y : `${y}-Q${Math.ceil(parseInt(m) / 3)}`;
    const existing = map.get(key);
    map.set(key, {
      month: key,
      label: period === "año" ? y : key.replace("-", " "),
      stripeGross: (existing?.stripeGross ?? 0) + r.stripeGross,
      stripeFees:  (existing?.stripeFees  ?? 0) + r.stripeFees,
      stripeNet:   (existing?.stripeNet   ?? 0) + r.stripeNet,
      uscNet:      (existing?.uscNet      ?? 0) + r.uscNet,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export default function IngresosPorFuente({
  stripeGross,
  stripeFees,
  stripeNet,
  uscGross,
  monthly,
  dateRange,
  uscLastDateLabel,
  lastUpdated,
}: {
  stripeGross: number;
  stripeFees: number;
  stripeNet: number;
  uscGross: number;
  monthly: IngresosPorFuenteRow[];
  dateRange?: string;
  /** Última fecha con datos reales de Urban en el CSV manual de Momence — Stripe se recorta a
   * esta misma fecha en este gráfico (y solo en este) para que la comparación entre ambas
   * fuentes no muestre meses donde solo tenemos un lado. */
  uscLastDateLabel?: string | null;
  lastUpdated?: string | null;
}) {
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [period, setPeriod] = useState<Period>("mes");

  // El CSV de Momence ya registra lo que paga Urban (11 €/clase, sin comisión visible para Aura)
  const uscNet     = uscGross;
  const totalBruto = stripeGross + uscNet;

  const grouped = groupByPeriod(monthly, period);

  // La tabla desglosa TODO el histórico (no solo el período seleccionado arriba), así que su
  // fila "Total" debe sumar las filas mostradas, no los KPI del período — el total no cambia
  // al reagrupar por trimestre/año, así que se calcula siempre sobre el detalle mensual.
  const tableStripeGross = monthly.reduce((s, r) => s + r.stripeGross, 0);
  const tableStripeFees  = monthly.reduce((s, r) => s + r.stripeFees, 0);
  const tableStripeNet   = monthly.reduce((s, r) => s + r.stripeNet, 0);
  const tableUscNet      = monthly.reduce((s, r) => s + r.uscNet, 0);
  const tableTotalBruto  = tableStripeGross + tableUscNet;

  const SOURCES = [
    { key: "stripe", label: "Stripe", color: "var(--color-primary)", value: stripeGross },
    { key: "urban",  label: "Urban",  color: "#F59E0B", value: uscNet },
  ];

  return (
    <ChartCard
      title="Ingresos por fuente"
      subtitle="Importe bruto (precio de venta, antes de comisión Stripe e impuestos) por canal"
      dateRange={dateRange}
      kpiItems={[
        {
          label: "Ventas totales",
          value: fmtEur(totalBruto),
          helper: "Stripe bruto + Urban",
        },
        {
          label: "Ventas Stripe",
          value: fmtEur(stripeGross),
          helper: `Neto tras comis.: ${fmtEur(stripeNet)} (−${fmtEur(stripeFees)})`,
        },
        {
          label: "Ventas Urban",
          value: fmtEur(uscNet),
          helper: `${USC_PRICE_PAID} €/clase · tarifa estudio ${USC_PRICE_STUDIO} €`,
        },
      ]}
      toolbar={
        <div className="flex items-center justify-between gap-3 w-full flex-wrap">
          <ChartTypeToggle
            value={chartType}
            onChange={(v) => setChartType(v as "bar" | "line")}
            options={[
              { value: "bar",  label: "Ver como barras", icon: <BarChart2 size={14} /> },
              { value: "line", label: "Ver como línea",  icon: <Activity  size={14} /> },
            ]}
          />
          <ToggleGroup
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </div>
      }
      dataSource={
        uscLastDateLabel
          ? `Stripe API (precio de venta, antes de comisión) + Urban Sports Club Momence CSV (11 €/clase, importación manual en Transacciones). Stripe se recorta hasta ${uscLastDateLabel} para igualar la última fecha con datos reales de Urban — hay ingresos de Stripe más recientes que no se muestran aquí.`
          : "Stripe API (precio de venta, antes de comisión) + Urban Sports Club Momence CSV (11 €/clase, importación manual en Transacciones)"
      }
      sources={["stripe", "momence"]}
      lastUpdated={lastUpdated}
    >
      {uscLastDateLabel && (
        <p className="text-[11px] text-warning bg-warning/10 rounded-[8px] px-2.5 py-1.5 mb-4">
          Urban solo tiene datos hasta el {uscLastDateLabel} (importación manual en Transacciones) — Stripe se recorta a la misma fecha para que la comparación no sea engañosa.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 min-w-0">
          <IngresosPorFuenteBody data={grouped} chartType={chartType} />
        </div>
        <div className="lg:col-span-1 min-w-0">
          <p className="text-xs font-medium text-navy/55 mb-2.5">Resumen</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-navy/5 mb-4">
            {SOURCES.map((s) => (
              <div
                key={s.key}
                style={{ flex: `${totalBruto > 0 ? s.value / totalBruto : 0} 0 0%`, backgroundColor: s.color }}
              />
            ))}
          </div>
          <InteractiveLegend
            items={SOURCES.map((s) => ({
              key: s.key,
              label: s.label,
              color: s.color,
              value: fmtEur(s.value),
              helper: totalBruto > 0 ? `${Math.round((s.value / totalBruto) * 100)}%` : "—",
            }))}
          />
        </div>
      </div>

      <CollapsibleTable>
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr className="border-b border-navy/[0.07]">
              <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Período</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Stripe bruto</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Comis. Stripe</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Stripe neto</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Urban</th>
              <th className="text-right py-2 text-navy/45 font-semibold uppercase tracking-wide">Total bruto</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((row) => (
              <tr key={row.month} className="border-b border-navy/[0.04]">
                <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">{row.label}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{row.stripeGross > 0 ? fmtEur(row.stripeGross) : "-"}</td>
                <td className="py-2 pr-3 text-right text-danger tabular-nums">{row.stripeFees > 0 ? `−${fmtEur(row.stripeFees)}` : "-"}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{row.stripeNet > 0 ? fmtEur(row.stripeNet) : "-"}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{row.uscNet > 0 ? fmtEur(row.uscNet) : "-"}</td>
                <td className="py-2 text-right text-navy font-medium tabular-nums">{fmtEur(row.stripeGross + row.uscNet)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-navy/[0.07] bg-navy/[0.025]">
              <td className="py-2 pr-3 text-navy/55 font-semibold">Total</td>
              <td className="py-2 pr-3 text-right text-navy font-semibold tabular-nums">{fmtEur(tableStripeGross)}</td>
              <td className="py-2 pr-3 text-right text-danger font-semibold tabular-nums">−{fmtEur(tableStripeFees)}</td>
              <td className="py-2 pr-3 text-right text-navy font-semibold tabular-nums">{fmtEur(tableStripeNet)}</td>
              <td className="py-2 pr-3 text-right text-navy font-semibold tabular-nums">{fmtEur(tableUscNet)}</td>
              <td className="py-2 text-right text-navy font-semibold tabular-nums">{fmtEur(tableTotalBruto)}</td>
            </tr>
          </tfoot>
        </table>
      </CollapsibleTable>
    </ChartCard>
  );
}
