"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { MonthlySubStats } from "@/lib/subscriptionCohort";
import type { BusinessEvent } from "@/lib/businessEvents";
import type { StripePayment } from "@/lib/stripePayments";
import { ChartCard, ChartTypeToggle, ToggleGroup, InteractiveLegend, CollapsibleTable, type MultiKpiItem } from "@/components/charts";
import { pct } from "@/lib/analytics";
import Drawer from "@/app/components/Drawer";
import type { EvolucionRow } from "./EvolucionIngresosBody";
import {
  PRODUCT_COLORS,
  buildSeriesFromMonthly,
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

type ChartType = "line" | "bar";

const PERIODS: { key: Period; label: string }[] = [
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año", label: "Año" },
];

export default function EvolucionSuscripcionesFullWidth({
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
  const [period, setPeriod] = useState<Period>("mes");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [barDrawer, setBarDrawer] = useState<{ month: string; key: string } | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const toggleHidden = (key: string) =>
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const baseSeries = buildSeriesFromMonthly(monthly);
  const { months, data } = regroupSeries(baseSeries.months, baseSeries.data, period);

  const keysByRevenue = [...new Set(monthly.flatMap((m) => m.items.map((i) => i.name)))].sort(
    (a, b) => {
      const totA = months.reduce((s, m) => s + (data.get(m)?.get(a) ?? 0), 0);
      const totB = months.reduce((s, m) => s + (data.get(m)?.get(b) ?? 0), 0);
      return totB - totA;
    },
  );
  const keys = keysByRevenue.slice(0, 8);

  const colorOf = (key: string) => PRODUCT_COLORS[keys.indexOf(key) % PRODUCT_COLORS.length];

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

  const legendTotals = keys.map((k) => ({ key: k, total: rows.reduce((s, r) => s + Number(r[k] ?? 0), 0) }));
  const legendGrandTotal = legendTotals.reduce((s, t) => s + t.total, 0);

  const selectedDrawerPayments = useMemo(() => {
    if (!selectedKey || !rawPayments || baseSeries.months.length === 0) return [];
    const fromMonth = baseSeries.months[0];
    const toMonth = baseSeries.months[baseSeries.months.length - 1];
    return rawPayments
      .filter((p) => p.inferredProduct === selectedKey && p.date.slice(0, 7) >= fromMonth && p.date.slice(0, 7) <= toMonth)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedKey, rawPayments, baseSeries.months]);

  const trendSummary = makeTrendSummary(baseSeries.months, baseSeries.data, keysByRevenue);

  const cohortRows = regroupCohorts(cohorts, period);
  const cohortByPeriod = new Map(cohortRows.map((c) => [c.month, c]));

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
        subtitle="Ingresos por producto · altas, bajas y reactivaciones de suscripción"
        dateRange={months.length > 0 ? `${periodLabel(months[0], period)} – ${periodLabel(months[months.length - 1], period)}` : undefined}
        kpiItems={kpiItems}
        toolbar={
          <>
            <ChartTypeToggle
              value={chartType}
              onChange={(v) => setChartType(v as ChartType)}
              options={[
                { value: "line", label: "Ver como línea", icon: <Activity size={14} /> },
                { value: "bar", label: "Ver como barras", icon: <BarChart2 size={14} /> },
              ]}
            />
            <div className="flex items-center gap-2 flex-wrap ml-auto">
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
          hoveredLegendKey={null}
          chartType={chartType}
          view="producto"
          colorOf={colorOf}
          eventsByMonth={eventsByMonth}
          onBarClick={period === "mes" ? (month, key) => setBarDrawer({ month, key }) : undefined}
        />

        <p className="text-xs font-medium text-navy/55 mt-5 mb-2.5">Resumen</p>
        <div className="flex h-3 rounded-full overflow-hidden bg-navy/5 mb-4">
          {legendTotals.map((t) => (
            <div
              key={t.key}
              style={{ flex: `${legendGrandTotal > 0 ? t.total / legendGrandTotal : 0} 0 0%`, backgroundColor: colorOf(t.key) }}
            />
          ))}
        </div>
        <InteractiveLegend
          items={legendTotals.map((t) => ({
            key: t.key,
            label: t.key,
            color: colorOf(t.key),
            value: fmtEur(t.total),
            helper: pct(legendGrandTotal > 0 ? t.total / legendGrandTotal : 0),
            hidden: hiddenKeys.has(t.key),
          }))}
          onSelect={(key) => setSelectedKey(key === selectedKey ? null : key)}
          onToggleVisibility={toggleHidden}
        />

        <CollapsibleTable>
          <table className="w-full min-w-max text-xs">
            <thead>
              <tr className="border-b border-navy/[0.07]">
                <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Producto</th>
                {months.map((m) => (
                  <th key={m} className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide whitespace-nowrap">
                    {periodLabel(m, period)}
                  </th>
                ))}
                <th className="text-right py-2 text-navy/45 font-semibold uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-navy/[0.04] bg-navy/[0.025]">
                <td className="py-2 pr-3 text-navy font-semibold whitespace-nowrap">Ingresos</td>
                {rows.map((row) => (
                  <td key={row.month} className="py-2 pr-3 text-right text-navy font-semibold tabular-nums">
                    {fmtEur(keys.reduce((s, k) => s + Number(row[k] ?? 0), 0))}
                  </td>
                ))}
                <td className="py-2 text-right text-navy font-semibold tabular-nums">{fmtEur(legendGrandTotal)}</td>
              </tr>
              {keys.map((k) => (
                <tr key={k} className="border-b border-navy/[0.04]">
                  <td className="py-1.5 pl-6 pr-3 text-navy/80 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorOf(k) }} />
                      {k}
                    </span>
                  </td>
                  {rows.map((row) => (
                    <td key={row.month} className="py-1.5 pr-3 text-right text-navy/80 tabular-nums">
                      {fmtEur(Number(row[k] ?? 0))}
                    </td>
                  ))}
                  <td className="py-1.5 text-right text-navy/80 tabular-nums">
                    {fmtEur(legendTotals.find((t) => t.key === k)?.total ?? 0)}
                  </td>
                </tr>
              ))}
              <tr className="border-b border-navy/[0.04]">
                <td className="py-2 pr-3 text-navy font-semibold whitespace-nowrap">Suscritos activos</td>
                {months.map((m) => (
                  <td key={m} className="py-2 pr-3 text-right text-navy tabular-nums">{cohortByPeriod.get(m)?.activeCount ?? "-"}</td>
                ))}
                <td className="py-2 text-right text-navy/40 tabular-nums">−</td>
              </tr>
              <tr className="border-b border-navy/[0.04]">
                <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">Bajas susc.</td>
                {months.map((m) => {
                  const c = cohortByPeriod.get(m);
                  return (
                    <td key={m} className="py-2 pr-3 text-right text-danger font-medium tabular-nums">{c ? `−${c.churned}` : "-"}</td>
                  );
                })}
                <td className="py-2 text-right text-danger font-medium tabular-nums">
                  −{cohortRows.reduce((s, c) => s + c.churned, 0)}
                </td>
              </tr>
              <tr className="border-b border-navy/[0.04]">
                <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">Clientes nuevos</td>
                {months.map((m) => {
                  const c = cohortByPeriod.get(m);
                  return (
                    <td key={m} className="py-2 pr-3 text-right text-success font-medium tabular-nums">{c ? `+${c.newSubs}` : "-"}</td>
                  );
                })}
                <td className="py-2 text-right text-success font-medium tabular-nums">
                  +{cohortRows.reduce((s, c) => s + c.newSubs, 0)}
                </td>
              </tr>
              <tr className="last:border-0">
                <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">Reactiv.</td>
                {months.map((m) => (
                  <td key={m} className="py-2 pr-3 text-right text-primary font-medium tabular-nums">{cohortByPeriod.get(m)?.reactivated ?? "-"}</td>
                ))}
                <td className="py-2 text-right text-primary font-medium tabular-nums">
                  {cohortRows.reduce((s, c) => s + c.reactivated, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </CollapsibleTable>
      </ChartCard>

      {barDrawer && (
        <Drawer
          title={barDrawer.key}
          subtitle={periodLabel(barDrawer.month, "mes")}
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

      {selectedKey && (
        <Drawer
          maxWidth="max-w-[420px]"
          header={
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: colorOf(selectedKey) }} />
              <h2 className="text-base font-semibold text-navy">{selectedKey}</h2>
            </div>
          }
          onClose={() => setSelectedKey(null)}
        >
          {selectedDrawerPayments.length === 0 ? (
            <p className="text-sm text-navy/45 px-6 py-8">Sin pagos registrados en Stripe para este período.</p>
          ) : (
            selectedDrawerPayments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-6 py-3.5 border-b border-navy/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{p.customerName ?? "Sin nombre"}</p>
                  <p className="text-xs text-navy/55 mt-0.5 truncate">{p.customerEmail ?? p.date}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0 text-success">+{fmtEur(p.amount)}</p>
              </div>
            ))
          )}
        </Drawer>
      )}
    </>
  );
}
