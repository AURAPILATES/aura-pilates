"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { MonthlySubStats } from "@/lib/subscriptionCohort";
import type { BusinessEvent } from "@/lib/businessEvents";
import type { StripePayment } from "@/lib/stripePayments";
import { ChartCard, ChartTypeToggle, ToggleGroup, type MultiKpiItem } from "@/components/charts";
import Drawer from "@/app/components/Drawer";
import type { EvolucionRow } from "./EvolucionIngresosBody";
import {
  PROCEDENCIA_COLORS,
  PRODUCT_COLORS,
  buildSeriesFromMonthly,
  buildSeriesFromProcedencia,
  regroupSeries,
  regroupCohorts,
  periodLabel,
  makeTrendSummary,
  fmtEur,
  type Period,
} from "./evolucionIngresosUtils";

const EvolucionIngresosBody = dynamic(() => import("./EvolucionIngresosBody"), {
  ssr: false,
  loading: () => <div className="h-[340px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

type View = "producto" | "procedencia";
type ChartType = "line" | "bar";

const PERIODS: { key: Period; label: string }[] = [
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año", label: "Año" },
];

export default function EvolucionSuscripciones({
  monthly,
  cohorts,
  events,
  rawPayments,
}: {
  monthly: MonthlyProductRevenue[];
  cohorts: MonthlySubStats[];
  events?: BusinessEvent[];
  rawPayments?: StripePayment[];
}) {
  const [view, setView] = useState<View>("producto");
  const [period, setPeriod] = useState<Period>("mes");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [hoveredLegendKey, setHoveredLegendKey] = useState<string | null>(null);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [barDrawer, setBarDrawer] = useState<{ month: string; key: string } | null>(null);

  const baseSeries = view === "producto" ? buildSeriesFromMonthly(monthly) : buildSeriesFromProcedencia(monthly);
  const { months, data } = regroupSeries(baseSeries.months, baseSeries.data, period);

  const keysByRevenue = [...new Set(view === "producto" ? monthly.flatMap((m) => m.items.map((i) => i.name)) : ["Interna", "Urban"])].sort(
    (a, b) => {
      const totA = months.reduce((s, m) => s + (data.get(m)?.get(a) ?? 0), 0);
      const totB = months.reduce((s, m) => s + (data.get(m)?.get(b) ?? 0), 0);
      return totB - totA;
    },
  );
  const keys = view === "producto" ? keysByRevenue.slice(0, 8) : keysByRevenue;

  const colorOf = (key: string) =>
    view === "procedencia" ? (PROCEDENCIA_COLORS[key] ?? "#6B7280") : PRODUCT_COLORS[keys.indexOf(key) % PRODUCT_COLORS.length];

  const rows: EvolucionRow[] = months.map((m) => {
    const row: EvolucionRow = { month: m, label: periodLabel(m, period) };
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

  const trendSummary = makeTrendSummary(baseSeries.months, baseSeries.data, keysByRevenue);

  const cohortRows = regroupCohorts(cohorts, period);
  const cohortByPeriod = new Map(cohortRows.map((c) => [c.month, c]));
  const procedenciaByPeriod = view === "procedencia" ? data : regroupSeries(buildSeriesFromProcedencia(monthly).months, buildSeriesFromProcedencia(monthly).data, period).data;

  const lastCohort = cohortRows.length > 0 ? cohortRows[cohortRows.length - 1] : null;
  const lastTotal = rows.length > 0 ? keys.reduce((s, k) => s + Number(rows[rows.length - 1][k] ?? 0), 0) : 0;
  const prevTotal = rows.length > 1 ? keys.reduce((s, k) => s + Number(rows[rows.length - 2][k] ?? 0), 0) : 0;

  const kpiItems: MultiKpiItem[] = [{ label: "Ingresos del período", value: fmtEur(lastTotal) }];
  if (prevTotal > 0) {
    const deltaPct = Math.round(((lastTotal - prevTotal) / prevTotal) * 100);
    kpiItems.push({
      label: "Variación",
      value: `${deltaPct > 0 ? "+" : ""}${deltaPct}%`,
      valueClassName: deltaPct >= 0 ? "text-success" : "text-danger",
    });
  }
  if (lastCohort) {
    kpiItems.push({ label: "Suscritos activos", value: String(lastCohort.activeCount) });
    kpiItems.push({
      label: "Altas / Bajas",
      value: (
        <>
          <span className="text-success">+{lastCohort.newSubs}</span>
          {" / "}
          <span className="text-danger">−{lastCohort.churned}</span>
        </>
      ),
    });
  }

  if (monthly.length === 0) {
    return <ChartCard title="Evolución de ingresos y suscripciones" subtitle="Sin datos suficientes" />;
  }

  return (
    <>
      <ChartCard
        title="Evolución de ingresos y suscripciones"
        subtitle="Ingresos por producto o procedencia · altas, bajas y reactivaciones de suscripción"
        dateRange={months.length > 0 ? `${periodLabel(months[0], period)} – ${periodLabel(months[months.length - 1], period)}` : undefined}
        kpiItems={kpiItems}
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
            <div className="flex items-center gap-2 flex-wrap">
              <ToggleGroup
                value={view}
                onChange={(v) => { setView(v as View); setHiddenKeys(new Set()); }}
                options={[{ value: "producto", label: "Producto" }, { value: "procedencia", label: "Procedencia" }]}
              />
              <ToggleGroup
                value={period}
                onChange={(v) => setPeriod(v as Period)}
                options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
              />
            </div>
          </>
        }
        dataSource="Ingresos: Stripe + catálogo Momence en vivo (Urban Sports Club desde CSV) · Altas/bajas/reactivaciones identificadas por el patrón de pagos de suscripción en Stripe"
        sources={["stripe", "momence"]}
        lastUpdated="ahora"
        aiInsight={
          trendSummary.length > 0 && (
            <div className="space-y-1">
              {trendSummary.map((sentence, i) => (
                <p key={i}>{sentence}</p>
              ))}
            </div>
          )
        }
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
          onBarClick={period === "mes" ? (month, key) => setBarDrawer({ month, key }) : undefined}
        />

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-max text-xs">
            <thead>
              <tr className="border-b border-navy/[0.07]">
                <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Período</th>
                <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Ingresos</th>
                <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Ingresos internos</th>
                <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Ingresos Urban</th>
                <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Suscritos</th>
                <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Bajas susc.</th>
                <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Clientes nuevos</th>
                <th className="text-right py-2 text-navy/45 font-semibold uppercase tracking-wide">Reactiv.</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const c = cohortByPeriod.get(m);
                const interna = procedenciaByPeriod.get(m)?.get("Interna") ?? 0;
                const urban = procedenciaByPeriod.get(m)?.get("Urban") ?? 0;
                return (
                  <tr key={m} className="border-b border-navy/[0.04] last:border-0">
                    <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">{periodLabel(m, period)}</td>
                    <td className="py-2 pr-3 text-right text-navy tabular-nums">{fmtEur(interna + urban)}</td>
                    <td className="py-2 pr-3 text-right text-navy tabular-nums">{fmtEur(interna)}</td>
                    <td className="py-2 pr-3 text-right text-navy tabular-nums">{fmtEur(urban)}</td>
                    <td className="py-2 pr-3 text-right text-navy tabular-nums">{c?.activeCount ?? "—"}</td>
                    <td className="py-2 pr-3 text-right text-danger font-medium tabular-nums">{c ? `−${c.churned}` : "—"}</td>
                    <td className="py-2 pr-3 text-right text-success font-medium tabular-nums">{c ? `+${c.newSubs}` : "—"}</td>
                    <td className="py-2 text-right text-primary font-medium tabular-nums">{c?.reactivated ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {barDrawer && (
        <Drawer
          title={barDrawer.key}
          subtitle={periodLabel(barDrawer.month, "mes")}
          onClose={() => setBarDrawer(null)}
        >
          <div className="p-3">
            {barDrawer.key === "Urban" || barDrawer.key === "Interna" ? (
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
