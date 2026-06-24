"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { BusinessEvent } from "@/lib/businessEvents";
import { fmt, pct } from "@/lib/analytics";
import { ChartCard, ChartTypeToggle, ToggleGroup } from "@/components/charts";
import type { EvolucionRow } from "./EvolucionIngresosBody";
import { MONTH_NAMES, PROCEDENCIA_COLORS, buildSeriesFromProcedencia, makeTrendSummary } from "./evolucionIngresosUtils";

const EvolucionIngresosBody = dynamic(() => import("./EvolucionIngresosBody"), {
  ssr: false,
  loading: () => <div className="h-[340px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

type Mode = "total" | "evolucion";
type ChartType = "line" | "bar";
type MethodRow = { key: string; label: string; revenue: number; count: number; bar: string };

export default function IngresosPorCanal({
  rows,
  combinedTotal,
  rangeLabel,
  monthly,
  events,
}: {
  rows: MethodRow[];
  combinedTotal: number;
  rangeLabel?: string | null;
  monthly?: MonthlyProductRevenue[];
  events?: BusinessEvent[];
}) {
  const [mode, setMode] = useState<Mode>("total");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [hoveredLegendKey, setHoveredLegendKey] = useState<string | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const { months, data } = monthly && monthly.length > 0 ? buildSeriesFromProcedencia(monthly) : { months: [], data: new Map() };
  const keys = ["Interna", "Urban"];
  const colorOf = (key: string) => PROCEDENCIA_COLORS[key] ?? "#6B7280";

  const evolRows: EvolucionRow[] = months.map((m) => {
    const [y, mm] = m.split("-");
    const row: EvolucionRow = { month: m, label: `${MONTH_NAMES[mm]}'${y.slice(2)}` };
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

  const trendSummary = makeTrendSummary(months, data, keys);

  return (
    <ChartCard
      title="Por canal de pago"
      subtitle={mode === "total" ? "Distribución de ingresos por método de pago en el período" : undefined}
      toolbar={
        <>
          {mode === "evolucion" ? (
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <ChartTypeToggle
                value={chartType}
                onChange={(v) => setChartType(v as ChartType)}
                options={[
                  { value: "line", label: "Ver como línea", icon: <Activity size={14} /> },
                  { value: "bar", label: "Ver como barras", icon: <BarChart2 size={14} /> },
                ]}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1 min-w-0">
                {keys.map((key) => {
                  const isHid = hiddenKeys.has(key);
                  const isDimmed = hoveredLegendKey !== null && hoveredLegendKey !== key && !isHid;
                  return (
                    <span
                      key={key}
                      className={`flex items-center gap-1.5 text-xs cursor-pointer select-none transition-opacity ${
                        isHid ? "opacity-30 line-through" : isDimmed ? "opacity-40 text-navy/60" : "text-navy/60"
                      }`}
                      title={isHid ? "Clic para mostrar" : "Clic para ocultar"}
                      onMouseEnter={() => setHoveredLegendKey(key)}
                      onMouseLeave={() => setHoveredLegendKey(null)}
                      onClick={() =>
                        setHiddenKeys((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        })
                      }
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorOf(key) }} />
                      {key}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <div />
          )}
          <ToggleGroup
            value={mode}
            onChange={(v) => setMode(v as Mode)}
            options={[{ value: "total", label: "Total" }, { value: "evolucion", label: "Evolución" }]}
          />
        </>
      }
      dataSource={`Stripe en vivo + Urban Sports Club (Momence CSV)${rangeLabel ? ` · datos hasta ${rangeLabel}` : ""}.`}
      sources={["stripe", "momence"]}
      aiInsight={
        mode === "evolucion" && trendSummary.length > 0 && (
          <div className="space-y-1">
            {trendSummary.map((sentence, i) => (
              <p key={i}>{sentence}</p>
            ))}
          </div>
        )
      }
    >
      {mode === "total" ? (
        <>
          <div className="space-y-4">
            {rows.map((row) => {
              const share = combinedTotal > 0 ? row.revenue / combinedTotal : 0;
              return (
                <div key={row.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-navy">{row.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-navy/55 tabular-nums">{row.count} cobros</span>
                      <span className="text-xs font-medium text-navy tabular-nums w-16 text-right">{fmt(row.revenue)}</span>
                      <span className="text-xs text-navy/55 w-8 text-right tabular-nums">{pct(share)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-navy/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${row.bar}`} style={{ width: pct(share) }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-navy/5 flex justify-between">
            <span className="text-xs text-navy/55">Total período</span>
            <span className="text-xs font-semibold text-navy">{fmt(combinedTotal)}</span>
          </div>
        </>
      ) : (
        <EvolucionIngresosBody
          rows={evolRows}
          keys={keys}
          hiddenKeys={hiddenKeys}
          hoveredLegendKey={hoveredLegendKey}
          chartType={chartType}
          view="procedencia"
          colorOf={colorOf}
          eventsByMonth={eventsByMonth}
        />
      )}
    </ChartCard>
  );
}
