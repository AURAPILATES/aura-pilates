"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { fmt, pct } from "@/lib/analytics";
import { ChartCard, type MultiKpiItem } from "@/components/charts";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { BusinessEvent } from "@/lib/businessEvents";
import type { EvolucionRow } from "./EvolucionIngresosBody";
import { PROCEDENCIA_COLORS, buildSeriesFromProcedencia, periodLabel } from "./evolucionIngresosUtils";

const EvolucionIngresosBody = dynamic(() => import("./EvolucionIngresosBody"), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

type MethodRow = { key: string; label: string; revenue: number; count: number; bar: string };

const CHANNEL_LABELS: Record<string, string> = { Interna: "Interno", Urban: "Urban Sports Club" };
const EMPTY_HIDDEN = new Set<string>();

function colorOf(key: string) {
  return PROCEDENCIA_COLORS[key] ?? "#6B7280";
}

export default function IngresosPorCanal({
  rows,
  combinedTotal,
  rangeLabel,
  comparisonTotal,
  compRangeLabel,
  monthly,
  events,
}: {
  rows: MethodRow[];
  combinedTotal: number;
  rangeLabel?: string | null;
  comparisonTotal?: number;
  compRangeLabel?: string;
  monthly: MonthlyProductRevenue[];
  events?: BusinessEvent[];
}) {
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
  const keys = ["Interna", "Urban"].filter((k) => months.some((m) => (data.get(m)?.get(k) ?? 0) > 0));
  const evolRows: EvolucionRow[] = months.map((m) => {
    const row: EvolucionRow = { month: m, label: periodLabel(m, "mes") };
    for (const k of keys) row[k] = data.get(m)?.get(k) ?? 0;
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

  return (
    <ChartCard
      title="Por canal de pago"
      subtitle="Distribución y evolución de ingresos por procedencia (interno vs. Urban Sports Club)"
      kpiItems={kpiItems}
      dataSource={`Stripe en vivo + Urban Sports Club (Momence CSV)${rangeLabel ? ` · datos hasta ${rangeLabel}` : ""}.`}
      sources={["stripe", "momence"]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 min-w-0">
          <div className="flex gap-3 mb-2">
            {keys.map((k) => (
              <div key={k} className="flex items-center gap-1.5 text-xs text-navy/55">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorOf(k) }} />
                {CHANNEL_LABELS[k] ?? k}
              </div>
            ))}
          </div>
          <EvolucionIngresosBody
            rows={evolRows}
            keys={keys}
            hiddenKeys={EMPTY_HIDDEN}
            hoveredLegendKey={null}
            chartType="line"
            view="procedencia"
            colorOf={colorOf}
            eventsByMonth={eventsByMonth}
          />
        </div>

        <div className="lg:col-span-1 min-w-0">
          <p className="text-xs font-medium text-navy/55 mb-2.5">Por canal</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-navy/5 mb-4">
            {channels.map((c) => (
              <div
                key={c.key}
                style={{ width: `${(combinedTotal > 0 ? c.revenue / combinedTotal : 0) * 100}%`, backgroundColor: colorOf(c.key) }}
              />
            ))}
          </div>
          <div className="space-y-3.5">
            {channels.map((c) => {
              const share = combinedTotal > 0 ? c.revenue / combinedTotal : 0;
              return (
                <div key={c.key}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: colorOf(c.key) }} />
                    <span className="text-xs font-medium text-navy truncate">{CHANNEL_LABELS[c.key] ?? c.key}</span>
                  </div>
                  <div className="flex items-baseline justify-between pl-4">
                    <span className="text-sm font-semibold text-navy tabular-nums">{fmt(c.revenue)}</span>
                    <span className="text-xs text-navy/50 tabular-nums">{pct(share)}</span>
                  </div>
                  <p className="pl-4 text-[11px] text-navy/45">{c.count} cobros</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
