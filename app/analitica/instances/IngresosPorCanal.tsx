"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { fmt, pct } from "@/lib/analytics";
import { ChartCard, InteractiveLegend, type MultiKpiItem } from "@/components/charts";
import Drawer from "@/app/components/Drawer";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { BusinessEvent } from "@/lib/businessEvents";
import type { StripePayment } from "@/lib/stripePayments";
import type { EvolucionRow } from "./EvolucionIngresosBody";
import { PROCEDENCIA_COLORS, buildSeriesFromProcedencia, periodLabel } from "./evolucionIngresosUtils";

const EvolucionIngresosBody = dynamic(() => import("./EvolucionIngresosBody"), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

type MethodRow = { key: string; label: string; revenue: number; count: number; bar: string };

const CHANNEL_LABELS: Record<string, string> = { Interna: "Interno", Urban: "Urban Sports Club" };
// Nombres cortos para el gráfico de evolución (leyenda y tooltip) — el panel "Por canal"
// usa el nombre completo de Urban Sports Club, pero en el gráfico ambos deben leerse igual de cortos.
const CHART_LABELS: Record<string, string> = { Interna: "Interno", Urban: "Urban" };
const CHART_COLORS: Record<string, string> = { Interno: PROCEDENCIA_COLORS.Interna, Urban: PROCEDENCIA_COLORS.Urban };

function colorOf(key: string) {
  return PROCEDENCIA_COLORS[key] ?? "#6B7280";
}

function chartColorOf(key: string) {
  return CHART_COLORS[key] ?? "#6B7280";
}

export default function IngresosPorCanal({
  rows,
  combinedTotal,
  rangeLabel,
  comparisonTotal,
  compRangeLabel,
  monthly,
  events,
  rawPayments,
}: {
  rows: MethodRow[];
  combinedTotal: number;
  rangeLabel?: string | null;
  comparisonTotal?: number;
  compRangeLabel?: string;
  monthly: MonthlyProductRevenue[];
  events?: BusinessEvent[];
  rawPayments?: StripePayment[];
}) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const toggleHidden = (rawKey: string) => {
    const chartKey = CHART_LABELS[rawKey] ?? rawKey;
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(chartKey)) next.delete(chartKey);
      else next.add(chartKey);
      return next;
    });
  };

  const totalCount = rows.reduce((s, r) => s + r.count, 0);

  const urbanRow = rows.find((r) => r.key === "usc");
  const urbanRevenue = urbanRow?.revenue ?? 0;
  const urbanCount = urbanRow?.count ?? 0;
  const internaRevenue = combinedTotal - urbanRevenue;
  const internaCount = totalCount - urbanCount;

  const channels = [
    { key: "Interna", revenue: internaRevenue, count: internaCount },
    { key: "Urban", revenue: urbanRevenue, count: urbanCount },
  ]
    .filter((c) => c.revenue > 0 || c.count > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const topChannel = channels[0] ?? null;
  const topShare = topChannel && combinedTotal > 0 ? topChannel.revenue / combinedTotal : 0;

  const kpiItems: MultiKpiItem[] = [
    { label: "Total período", value: fmt(combinedTotal) },
    { label: "Cobros", value: String(totalCount) },
  ];
  if (topChannel) {
    kpiItems.push({ label: "Canal principal", value: CHANNEL_LABELS[topChannel.key] ?? topChannel.key, helper: pct(topShare) });
  }
  if (comparisonTotal !== undefined && comparisonTotal > 0) {
    const deltaPct = Math.round(((combinedTotal - comparisonTotal) / comparisonTotal) * 100);
    kpiItems.push({
      label: "Variación",
      value: `${deltaPct > 0 ? "+" : ""}${deltaPct}%`,
      valueClassName: deltaPct >= 0 ? "text-success" : "text-danger",
      helper: compRangeLabel ? `vs ${fmt(comparisonTotal)} (${compRangeLabel})` : `vs ${fmt(comparisonTotal)}`,
    });
  }

  const { months, data } = buildSeriesFromProcedencia(monthly);
  const rawKeys = ["Interna", "Urban"].filter((k) => months.some((m) => (data.get(m)?.get(k) ?? 0) > 0));
  const keys = rawKeys.map((k) => CHART_LABELS[k] ?? k);
  const evolRows: EvolucionRow[] = months.map((m) => {
    const row: EvolucionRow = { month: m, label: periodLabel(m, "mes") };
    for (const rk of rawKeys) row[CHART_LABELS[rk] ?? rk] = data.get(m)?.get(rk) ?? 0;
    return row;
  });

  const eventsByMonth = useMemo(() => {
    const map = new Map<string, BusinessEvent[]>();
    for (const ev of events ?? []) {
      const m = ev.fecha.slice(0, 7);
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(ev);
    }
    return map;
  }, [events]);

  const selectedTxns = useMemo(() => {
    if (selectedChannel !== "Interna" || !rawPayments) return [];
    return [...rawPayments].sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedChannel, rawPayments]);

  return (
    <ChartCard
      title="Por canal de pago"
      subtitle="Distribución y evolución de ingresos por procedencia (interno vs. Urban Sports Club)"
      dateRange={rangeLabel ? `hasta ${rangeLabel}` : undefined}
      kpiItems={kpiItems}
      dataSource={`Stripe en vivo + Urban Sports Club (Momence CSV)${rangeLabel ? ` · datos hasta ${rangeLabel}` : ""}.`}
      sources={["stripe", "momence"]}
      lastUpdated="ahora"
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 min-w-0">
          <EvolucionIngresosBody
            rows={evolRows}
            keys={keys}
            hiddenKeys={hiddenKeys}
            hoveredLegendKey={null}
            chartType="line"
            view="procedencia"
            colorOf={chartColorOf}
            eventsByMonth={eventsByMonth}
            height={220}
          />
        </div>

        <div className="lg:col-span-1 min-w-0">
          <p className="text-xs font-medium text-navy/55 mb-2.5">Por canal</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-navy/5 mb-4">
            {channels.map((c) => (
              <div
                key={c.key}
                style={{ flex: `${combinedTotal > 0 ? c.revenue / combinedTotal : 0} 0 0%`, backgroundColor: colorOf(c.key) }}
              />
            ))}
          </div>
          <InteractiveLegend
            items={channels.map((c) => {
              const share = combinedTotal > 0 ? c.revenue / combinedTotal : 0;
              return {
                key: c.key,
                label: CHANNEL_LABELS[c.key] ?? c.key,
                color: colorOf(c.key),
                value: fmt(c.revenue),
                helper: pct(share),
                hidden: hiddenKeys.has(CHART_LABELS[c.key] ?? c.key),
              };
            })}
            onSelect={(key) => setSelectedChannel(key === selectedChannel ? null : key)}
            onToggleVisibility={toggleHidden}
          />
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr className="border-b border-navy/[0.07]">
              <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Período</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Total</th>
              {keys.map((k) => (
                <th key={k} className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide whitespace-nowrap">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {evolRows.map((row) => {
              const total = keys.reduce((s, k) => s + Number(row[k] ?? 0), 0);
              return (
                <tr key={row.month} className="border-b border-navy/[0.04] last:border-0">
                  <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">{row.label}</td>
                  <td className="py-2 pr-3 text-right text-navy font-medium tabular-nums">{fmt(total)}</td>
                  {keys.map((k) => (
                    <td key={k} className="py-2 pr-3 text-right text-navy tabular-nums">
                      {Number(row[k] ?? 0) > 0 ? fmt(Number(row[k])) : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedChannel && (
        <Drawer
          maxWidth="max-w-[420px]"
          header={
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: colorOf(selectedChannel) }} />
              <h2 className="text-base font-semibold text-navy">{CHANNEL_LABELS[selectedChannel] ?? selectedChannel}</h2>
            </div>
          }
          onClose={() => setSelectedChannel(null)}
        >
          {selectedChannel === "Urban" ? (
            <p className="text-sm text-navy/45 px-6 py-8">
              Los ingresos de Urban Sports Club llegan por transferencia bancaria — no hay datos individuales por alumno.
            </p>
          ) : selectedTxns.length === 0 ? (
            <p className="text-sm text-navy/45 px-6 py-8">Sin pagos registrados en Stripe para este período.</p>
          ) : (
            selectedTxns.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-6 py-3.5 border-b border-navy/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{p.customerName ?? "Sin nombre"}</p>
                  <p className="text-xs text-navy/55 mt-0.5 truncate">{p.customerEmail ?? p.date}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0 text-success">+{fmt(p.amount)}</p>
              </div>
            ))
          )}
        </Drawer>
      )}
    </ChartCard>
  );
}
