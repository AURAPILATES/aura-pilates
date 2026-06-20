"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import type { Sale } from "@/lib/sales";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { BusinessEvent } from "@/lib/businessEvents";
import type { StripePayment } from "@/lib/stripePayments";
import { ChartCard, ChartTypeToggle, ToggleGroup } from "@/components/charts";
import Drawer from "@/app/components/Drawer";
import type { EvolucionRow } from "./EvolucionIngresosBody";

const EvolucionIngresosBody = dynamic(() => import("./EvolucionIngresosBody"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

type View = "procedencia" | "producto";
type ChartType = "line" | "bar";

const MONTH_NAMES: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

const PROCEDENCIA_COLORS: Record<string, string> = { "Interna": "#6B7ED6", "Urban": "#D4AA35" };
const PRODUCT_COLORS = ["#6B7ED6", "#9260B8", "#D4AA35", "#4A7A9B", "#4A9870", "#D46055", "#C46890", "#3AA09C"];

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

function buildSeries(sales: Sale[], getKey: (s: Sale) => string) {
  const months = [...new Set(sales.map((s) => s.paymentDate.slice(0, 7)))].sort();
  const data = new Map<string, Map<string, number>>();
  for (const s of sales) {
    const m = s.paymentDate.slice(0, 7);
    const k = getKey(s);
    if (!data.has(m)) data.set(m, new Map());
    const row = data.get(m)!;
    row.set(k, (row.get(k) ?? 0) + s.amount);
  }
  return { months, data };
}

function buildSeriesFromMonthly(monthly: MonthlyProductRevenue[]) {
  const months = monthly.map((m) => m.month);
  const data = new Map<string, Map<string, number>>();
  for (const m of monthly) {
    const row = new Map<string, number>();
    for (const item of m.items) row.set(item.name, item.revenue);
    data.set(m.month, row);
  }
  return { months, data };
}

function buildSeriesFromProcedencia(monthly: MonthlyProductRevenue[]) {
  const months = monthly.map((m) => m.month);
  const data = new Map<string, Map<string, number>>();
  for (const m of monthly) {
    const urban = m.items.find((i) => i.name === "Urban")?.revenue ?? 0;
    const interna = m.total - urban;
    const row = new Map<string, number>();
    if (interna > 0) row.set("Interna", interna);
    if (urban > 0) row.set("Urban", urban);
    data.set(m.month, row);
  }
  return { months, data };
}

function makeTrendSummary(
  months: string[],
  data: Map<string, Map<string, number>>,
  keys: string[],
): string[] {
  if (months.length < 2) return [];
  const win = Math.min(3, Math.floor(months.length / 2));
  const recent = months.slice(-win);
  const prev = months.slice(-(win * 2), -win);
  if (prev.length === 0) return [];

  const sum = (ms: string[], k: string) => ms.reduce((s, m) => s + (data.get(m)?.get(k) ?? 0), 0);
  const sumAll = (ms: string[]) => keys.reduce((s, k) => s + sum(ms, k), 0);

  const sentences: string[] = [];
  const rTot = sumAll(recent);
  const pTot = sumAll(prev);
  if (pTot > 0) {
    const pct = Math.round(((rTot - pTot) / pTot) * 100);
    const ref = win === 1 ? "el mes anterior" : `los ${win} meses anteriores`;
    if (Math.abs(pct) < 4) sentences.push(`Los ingresos totales se mantienen estables respecto a ${ref}.`);
    else if (pct > 0) sentences.push(`Los ingresos totales han crecido un ${pct}% respecto a ${ref}.`);
    else sentences.push(`Los ingresos totales han bajado un ${Math.abs(pct)}% respecto a ${ref}.`);
  }

  const trends = keys.slice(0, 6).flatMap((k) => {
    const r = sum(recent, k);
    const p = sum(prev, k);
    if (p === 0 || (r === 0 && p === 0)) return [];
    return [{ label: k, pct: Math.round(((r - p) / p) * 100) }];
  });

  const growing = trends.filter((t) => t.pct >= 5).sort((a, b) => b.pct - a.pct);
  const stable = trends.filter((t) => Math.abs(t.pct) < 5);
  const declining = trends.filter((t) => t.pct <= -5).sort((a, b) => a.pct - b.pct);

  if (growing.length > 0) sentences.push(`Suben: ${growing.map((t) => `${t.label} (+${t.pct}%)`).join(", ")}.`);
  if (stable.length > 0) sentences.push(`Se mantienen estables: ${stable.map((t) => t.label).join(", ")}.`);
  if (declining.length > 0) sentences.push(`Bajan: ${declining.map((t) => `${t.label} (${t.pct}%)`).join(", ")}.`);

  return sentences;
}

export default function EvolucionIngresos({ sales, monthly, events, rawPayments }: {
  sales: Sale[];
  monthly?: MonthlyProductRevenue[];
  events?: BusinessEvent[];
  rawPayments?: StripePayment[];
}) {
  const [view, setView] = useState<View>("procedencia");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [hoveredLegendKey, setHoveredLegendKey] = useState<string | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [barDrawer, setBarDrawer] = useState<{ month: string; key: string } | null>(null);

  const getKey = (s: Sale) => s.method;
  const useProcedencia = view === "procedencia" && !!monthly && monthly.length > 0;
  const useMonthly = view === "producto" && !!monthly && monthly.length > 0;

  const { months, data } = useProcedencia
    ? buildSeriesFromProcedencia(monthly!)
    : useMonthly
    ? buildSeriesFromMonthly(monthly!)
    : buildSeries(sales, getKey);

  const rawKeys = useProcedencia
    ? ["Interna", "Urban"]
    : useMonthly
    ? [...new Set(monthly!.flatMap((m) => m.items.map((i) => i.name)))]
    : [...new Set(sales.map(getKey))];

  const keysByRevenue = [...rawKeys].sort((a, b) => {
    const totA = months.reduce((s, m) => s + (data.get(m)?.get(a) ?? 0), 0);
    const totB = months.reduce((s, m) => s + (data.get(m)?.get(b) ?? 0), 0);
    return totB - totA;
  });
  const keys = view === "producto" ? keysByRevenue.slice(0, 8) : keysByRevenue;

  const colorOf = (key: string) => {
    const i = keys.indexOf(key);
    return view === "procedencia" ? (PROCEDENCIA_COLORS[key] ?? "#6B7280") : PRODUCT_COLORS[i % PRODUCT_COLORS.length];
  };

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
    if (barDrawer.key === "Urban" || barDrawer.key === "Interna") return [];
    return rawPayments
      .filter((p) => p.date.slice(0, 7) === barDrawer.month && p.inferredProduct === barDrawer.key)
      .map((p) => ({ name: p.customerName, email: p.customerEmail, amount: p.amount }));
  }, [barDrawer, rawPayments]);

  const trendSummary = makeTrendSummary(months, data, keys);

  return (
    <>
      <ChartCard
        title="Evolución de ingresos"
        toolbar={
          <>
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
            <ToggleGroup
              value={view}
              onChange={(v) => { setView(v as View); setHiddenKeys(new Set()); }}
              options={[{ value: "procedencia", label: "Procedencia" }, { value: "producto", label: "Producto" }]}
            />
          </>
        }
        dataSource="Stripe · ingresos brutos por mes"
      >
        <EvolucionIngresosBody
          rows={rows}
          keys={keys}
          hiddenKeys={hiddenKeys}
          hoveredLegendKey={hoveredLegendKey}
          chartType={chartType}
          view={view}
          colorOf={colorOf}
          eventsByMonth={eventsByMonth}
          onBarClick={(month, key) => setBarDrawer({ month, key })}
        />
        {trendSummary.length > 0 && (
          <div className="mt-3 border-t border-navy/[0.07] pt-3 space-y-1">
            {trendSummary.map((sentence, i) => (
              <p key={i} className="text-xs text-navy/55 leading-relaxed">{sentence}</p>
            ))}
          </div>
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
            {barDrawer.key === "Urban" ? (
              <p className="text-xs text-navy/45 text-center py-8 px-4">
                Los ingresos de Urban Sports Club llegan por transferencia bancaria — no hay datos individuales por alumno.
              </p>
            ) : drawerStudents.length === 0 ? (
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
