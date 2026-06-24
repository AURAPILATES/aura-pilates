"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { BusinessEvent } from "@/lib/businessEvents";
import type { StripePayment } from "@/lib/stripePayments";
import { fmt, pct } from "@/lib/analytics";
import { ChartCard, ChartTypeToggle, ToggleGroup } from "@/components/charts";
import Drawer from "@/app/components/Drawer";
import type { EvolucionRow } from "./EvolucionIngresosBody";
import { MONTH_NAMES, PRODUCT_COLORS, buildSeriesFromMonthly, makeTrendSummary, fmtEur } from "./evolucionIngresosUtils";

const EvolucionIngresosBody = dynamic(() => import("./EvolucionIngresosBody"), {
  ssr: false,
  loading: () => <div className="h-[340px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

type Mode = "total" | "evolucion";
type ChartType = "line" | "bar";
type ProductRow = { item: string; revenue: number; count: number; share: number; color: string };

const R = 80;
const CX = 100;
const CY = 100;
const CIRC = 2 * Math.PI * R;
const SW = 20;

export default function IngresosPorProducto({
  segments,
  total,
  monthly,
  events,
  rawPayments,
}: {
  segments: ProductRow[];
  total: number;
  monthly?: MonthlyProductRevenue[];
  events?: BusinessEvent[];
  rawPayments?: StripePayment[];
}) {
  const [mode, setMode] = useState<Mode>("total");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [hoveredLegendKey, setHoveredLegendKey] = useState<string | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [barDrawer, setBarDrawer] = useState<{ month: string; key: string } | null>(null);

  const { months, data } = monthly && monthly.length > 0 ? buildSeriesFromMonthly(monthly) : { months: [], data: new Map() };

  const keysByRevenue = [...new Set(monthly?.flatMap((m) => m.items.map((i) => i.name)) ?? [])].sort((a, b) => {
    const totA = months.reduce((s, m) => s + (data.get(m)?.get(a) ?? 0), 0);
    const totB = months.reduce((s, m) => s + (data.get(m)?.get(b) ?? 0), 0);
    return totB - totA;
  });
  const keys = keysByRevenue.slice(0, 8);

  const colorOf = (key: string) => PRODUCT_COLORS[keys.indexOf(key) % PRODUCT_COLORS.length];

  const rows: EvolucionRow[] = months.map((m) => {
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

  const drawerStudents = useMemo(() => {
    if (!barDrawer || !rawPayments) return [];
    return rawPayments
      .filter((p) => p.date.slice(0, 7) === barDrawer.month && p.inferredProduct === barDrawer.key)
      .map((p) => ({ name: p.customerName, email: p.customerEmail, amount: p.amount }));
  }, [barDrawer, rawPayments]);

  const trendSummary = makeTrendSummary(months, data, keys);

  let acc = 0;
  const donutSegments = segments.map((s) => {
    const dash = s.share * CIRC;
    const gap = 2;
    const offset = -(acc + (segments.length > 1 ? gap / 2 : 0));
    acc += dash + gap;
    return { ...s, dash: Math.max(dash - gap, 0), offset };
  });

  return (
    <>
      <ChartCard
        title="Ingresos por producto"
        subtitle={mode === "total" ? "Distribución de ingresos por producto o tarifa en el período" : undefined}
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
        dataSource="Stripe + catálogo Momence en vivo"
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
          segments.length === 0 ? (
            <p className="text-sm text-navy/45 text-center py-10">Sin datos de productos.</p>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <div className="relative w-[180px] h-[180px]">
                  <svg viewBox="0 0 200 200" width="180" height="180">
                    <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(28,25,23,0.05)" strokeWidth={SW} />
                    <g transform={`rotate(-90, ${CX}, ${CY})`}>
                      {donutSegments.map((seg) => (
                        <circle
                          key={seg.item}
                          cx={CX} cy={CY} r={R}
                          fill="none"
                          stroke={seg.color}
                          strokeWidth={SW}
                          strokeDasharray={`${seg.dash} ${CIRC}`}
                          strokeDashoffset={seg.offset}
                          strokeLinecap="round"
                        />
                      ))}
                    </g>
                    <foreignObject x="20" y="70" width="160" height="70">
                      <div className="h-full flex flex-col items-center justify-center text-center">
                        <p className="text-[11px] text-navy/45 font-medium mb-1">Ingresos</p>
                        <p className="text-lg font-semibold text-navy tabular-nums leading-tight">{fmt(total)}</p>
                      </div>
                    </foreignObject>
                  </svg>
                </div>
              </div>

              <div className="divide-y divide-navy/[0.05]">
                {segments.map((seg) => (
                  <div key={seg.item} className="flex items-center gap-2.5 py-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-navy truncate">{seg.item}</p>
                      <p className="text-xs text-navy/50">{seg.count} ventas</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-medium text-navy tabular-nums">{fmt(seg.revenue)}</p>
                      <p className="text-xs text-navy/50 tabular-nums">{pct(seg.share)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          <EvolucionIngresosBody
            rows={rows}
            keys={keys}
            hiddenKeys={hiddenKeys}
            hoveredLegendKey={hoveredLegendKey}
            chartType={chartType}
            view="producto"
            colorOf={colorOf}
            eventsByMonth={eventsByMonth}
            onBarClick={(month, key) => setBarDrawer({ month, key })}
          />
        )}
      </ChartCard>

      {barDrawer && (
        <Drawer
          title={barDrawer.key}
          subtitle={(() => {
            const [y, mm] = barDrawer.month.split("-");
            return `${MONTH_NAMES[mm]} ${y}`;
          })()}
          onClose={() => setBarDrawer(null)}
        >
          <div className="p-3">
            {drawerStudents.length === 0 ? (
              <p className="text-xs text-navy/45 text-center py-8">Sin pagos registrados en Stripe para este producto y mes.</p>
            ) : (
              drawerStudents.map((s, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2.5 border-b border-navy/[0.06] last:border-0">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
                    {s.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-navy truncate">{s.name ?? "Sin nombre"}</p>
                    <p className="text-[11px] text-navy/45 truncate">{s.email ?? ""}</p>
                  </div>
                  <p className="text-xs font-semibold text-navy shrink-0">{fmtEur(s.amount)}</p>
                </div>
              ))
            )}
          </div>
        </Drawer>
      )}
    </>
  );
}
