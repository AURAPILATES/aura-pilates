"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import { ChartCard, ChartTypeToggle, ToggleGroup, InteractiveLegend, StaticLegend, CollapsibleTable } from "@/components/charts";
import { pctDelta } from "@/components/charts/DeltaBadge";
import { pct } from "@/lib/analytics";
import { ivaRepercutidoFromGross } from "@/lib/taxCalc";
import Drawer from "@/app/components/Drawer";
import type { IngresosPorFuenteRow } from "./IngresosPorFuenteBody";
import type { EvolucionRow } from "./EvolucionIngresosBody";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { MonthlySubStats } from "@/lib/subscriptionCohort";
import type { BusinessEvent } from "@/lib/businessEvents";
import type { StripePayment } from "@/lib/stripePayments";
import type { ChannelEconomicsRow } from "@/lib/channelEconomics";
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

const IngresosPorFuenteBody = dynamic(() => import("./IngresosPorFuenteBody"), {
  ssr: false,
  loading: () => <div className="h-[240px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});
const EvolucionIngresosBody = dynamic(() => import("./EvolucionIngresosBody"), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});
const EconomiaPorCanalBody = dynamic(() => import("./EconomiaPorCanalBody"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

type View = "fuente" | "producto" | "canal";
type ChartType = "bar" | "line";

function fmtEurDecimal(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " €";
}

const PERIODS: { key: Period; label: string }[] = [
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año", label: "Año" },
];

/** Versión compacta para móvil, donde "38.330 €" no cabe en 3 columnas y se parte en dos
 * líneas - p.ej. "38,3k €". En escritorio se muestra el importe completo. */
function fmtEurCompact(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1000) {
    return `${(abs / 1000).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k €`;
  }
  return fmtEur(abs);
}

/** Importe con dos representaciones: compacta en móvil, completa (sm+) en escritorio. */
function ResponsiveEur({ value, prefix = "" }: { value: number; prefix?: string }) {
  return (
    <>
      <span className="sm:hidden">{prefix}{fmtEurCompact(value)}</span>
      <span className="hidden sm:inline">{prefix}{fmtEur(value)}</span>
    </>
  );
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
      stripeGross:    (existing?.stripeGross    ?? 0) + r.stripeGross,
      stripeFees:     (existing?.stripeFees     ?? 0) + r.stripeFees,
      stripeNet:      (existing?.stripeNet      ?? 0) + r.stripeNet,
      uscNet:         (existing?.uscNet         ?? 0) + r.uscNet,
      uscBank:        (existing?.uscBank        ?? 0) + r.uscBank,
      urbanClasses:   (existing?.urbanClasses   ?? 0) + r.urbanClasses,
      urbanEstimated: (existing?.urbanEstimated ?? 0) + r.urbanEstimated,
      // El bloque (trimestre/año) es "parcialmente estimado" si algún mes suyo lo es.
      urbanIsEstimated: (existing?.urbanIsEstimated ?? false) || r.urbanIsEstimated,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export default function VentasPor({
  stripeGross,
  stripeFees,
  stripeNet,
  uscGross,
  stripeGrossComp,
  stripeFeesComp,
  uscGrossComp,
  urbanIvaRate = 21,
  monthly,
  dateRange,
  lastUpdated,
  monthlyProducto,
  cohorts,
  events,
  rawPayments,
  channelEconomics,
}: {
  stripeGross: number;
  stripeFees: number;
  stripeNet: number;
  uscGross: number;
  /** Mismos totales, calculados sobre el período de comparación - solo para el badge de variación. */
  stripeGrossComp: number;
  stripeFeesComp: number;
  uscGrossComp: number;
  /** Tipo de IVA real de Urban Sports Club (de su contacto en Configuración → Contactos), no
   * necesariamente el mismo 21% que Stripe - para "Ventas netas" no lo asume, lo recibe. */
  urbanIvaRate?: number;
  monthly: IngresosPorFuenteRow[];
  dateRange?: string;
  lastUpdated?: string | null;
  monthlyProducto: MonthlyProductRevenue[];
  cohorts: MonthlySubStats[];
  events?: BusinessEvent[];
  rawPayments?: StripePayment[];
  channelEconomics: ChannelEconomicsRow[];
}) {
  const [view, setView] = useState<View>("fuente");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [period, setPeriod] = useState<Period>("mes");
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [barDrawer, setBarDrawer] = useState<{ month: string; key: string } | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sourceDrawer, setSourceDrawer] = useState<{ month: string; source: "stripe" | "urban" } | null>(null);

  // ── Vista "fuente" (Stripe vs. Urban) ──
  const uscNet     = uscGross;
  const totalBruto = stripeGross + uscNet;
  // Cada bruto ya incluye SU IVA - hay que EXTRAERLO (gross - gross/(1+tipo) ), no restar un %
  // plano del total, que descontaría más o menos IVA del que de verdad lleva. Stripe siempre al
  // 21% (venta a consumidor); Urban al tipo real de su contacto (puede no ser 21%).
  const ventasNetas = totalBruto - stripeFees
    - ivaRepercutidoFromGross(stripeGross, 21) - ivaRepercutidoFromGross(uscNet, urbanIvaRate);
  const grouped = groupByPeriod(monthly, period);

  const totalBrutoComp = stripeGrossComp + uscGrossComp;
  const ventasNetasComp = totalBrutoComp - stripeFeesComp
    - ivaRepercutidoFromGross(stripeGrossComp, 21) - ivaRepercutidoFromGross(uscGrossComp, urbanIvaRate);
  const ventasDelta   = pctDelta(totalBruto, totalBrutoComp);
  const comisionDelta = pctDelta(stripeFees, stripeFeesComp, true);
  const netasDelta    = pctDelta(ventasNetas, ventasNetasComp);

  // La tabla desglosa TODO el histórico (no solo el período seleccionado arriba), así que su
  // fila "Total" debe sumar las filas mostradas, no los KPI del período - el total no cambia
  // al reagrupar por trimestre/año, así que se calcula siempre sobre el detalle mensual.
  const tableStripeGross = monthly.reduce((s, r) => s + r.stripeGross, 0);
  const tableStripeFees  = monthly.reduce((s, r) => s + r.stripeFees, 0);
  const tableStripeNet   = monthly.reduce((s, r) => s + r.stripeNet, 0);
  const tableUscNet      = monthly.reduce((s, r) => s + r.uscNet, 0);
  const tableTotalBruto  = tableStripeGross + tableUscNet;
  const tableUrbanClasses = monthly.reduce((s, r) => s + r.urbanClasses, 0);
  const hasUrbanClasses   = tableUrbanClasses > 0;

  const SOURCES = [
    { key: "stripe", label: "Stripe", color: "var(--chart-violet-1)", value: stripeGross },
    { key: "urban",  label: "Urban",  color: "var(--color-warning)", value: uscNet },
  ];

  // ── Vista "producto" ──
  const toggleHidden = (key: string) =>
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const baseSeries = buildSeriesFromMonthly(monthlyProducto);
  const { months, data } = regroupSeries(baseSeries.months, baseSeries.data, period);

  const keysByRevenue = [...new Set(monthlyProducto.flatMap((m) => m.items.map((i) => i.name)))].sort(
    (a, b) => {
      const totA = months.reduce((s, m) => s + (data.get(m)?.get(a) ?? 0), 0);
      const totB = months.reduce((s, m) => s + (data.get(m)?.get(b) ?? 0), 0);
      return totB - totA;
    },
  );
  const productKeys = keysByRevenue.slice(0, 8);

  const colorOf = (key: string) => PRODUCT_COLORS[productKeys.indexOf(key) % PRODUCT_COLORS.length];

  const productRows: EvolucionRow[] = months.map((m) => {
    const row: EvolucionRow = { month: m, label: periodLabel(m, period) };
    for (const k of productKeys) row[k] = data.get(m)?.get(k) ?? 0;
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

  const sourceDrawerPayments = useMemo(() => {
    if (!sourceDrawer || sourceDrawer.source !== "stripe" || !rawPayments) return [];
    return rawPayments
      .filter((p) => p.date.slice(0, 7) === sourceDrawer.month)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [sourceDrawer, rawPayments]);

  const sourceDrawerUrbanRow = sourceDrawer?.source === "urban"
    ? monthly.find((r) => r.month === sourceDrawer.month)
    : null;

  const legendTotals = productKeys.map((k) => ({ key: k, total: productRows.reduce((s, r) => s + Number(r[k] ?? 0), 0) }));
  const legendGrandTotal = legendTotals.reduce((s, t) => s + t.total, 0);

  const selectedDrawerPayments = useMemo(() => {
    if (!selectedKey || selectedKey === "Urban" || !rawPayments || baseSeries.months.length === 0) return [];
    const fromMonth = baseSeries.months[0];
    const toMonth = baseSeries.months[baseSeries.months.length - 1];
    return rawPayments
      .filter((p) => p.inferredProduct === selectedKey && p.date.slice(0, 7) >= fromMonth && p.date.slice(0, 7) <= toMonth)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedKey, rawPayments, baseSeries.months]);

  // Urban no pasa por Stripe, así que su drawer no lista pagos individuales - agrega clases e
  // importe del mismo período (mismo criterio que la fila mensual de la vista Fuente).
  const selectedUrbanSummary = useMemo(() => {
    if (selectedKey !== "Urban" || baseSeries.months.length === 0) return null;
    const fromMonth = baseSeries.months[0];
    const toMonth = baseSeries.months[baseSeries.months.length - 1];
    const rows = monthly.filter((r) => r.month >= fromMonth && r.month <= toMonth);
    return {
      classes: rows.reduce((s, r) => s + r.urbanClasses, 0),
      amount: rows.reduce((s, r) => s + r.uscNet, 0),
    };
  }, [selectedKey, monthly, baseSeries.months]);

  const trendSummary = makeTrendSummary(baseSeries.months, baseSeries.data, keysByRevenue);

  const cohortRows = regroupCohorts(cohorts, period);
  const cohortByPeriod = new Map(cohortRows.map((c) => [c.month, c]));

  const title = (
    <span className="flex items-center gap-2">
      Ventas por
      <ToggleGroup
        value={view}
        onChange={(v) => setView(v as View)}
        options={[
          { value: "fuente", label: "Fuente" },
          { value: "producto", label: "Producto" },
          { value: "canal", label: "Canal" },
        ]}
      />
    </span>
  );

  // "Canal": € por clase realmente asistida, Stripe (interno) vs Urban Sports Club - responde
  // si el canal Urban compensa al ritmo actual frente a lo que deja un cliente interno de media.
  // Antes vivía en su propio ChartCard ("Economía por canal"); se fusiona aquí porque es la misma
  // pregunta que Fuente/Producto (de dónde sale el ingreso) mirada por clase en vez de por €.
  // El KPI es UNA media combinada (Stripe + Urban), no una por canal: separarla por canal se leía
  // como si "€/clase Urban" fuera la tarifa pactada con Urban, cuando en realidad mezcla meses con
  // importe real del banco (que no cuadra exacto con clases × tarifa) - la media combinada evita
  // esa lectura errónea. El desglose por canal se sigue viendo en el gráfico de abajo.
  // Ver [[project-momence-sales-migration]].
  const totalRevenueCanal = channelEconomics.reduce((s, r) => s + r.stripeRevenue + r.urbanRevenue, 0);
  const totalClassesCanal = channelEconomics.reduce((s, r) => s + r.stripeClasses + r.urbanClasses, 0);
  const avgPerClassCanal = totalClassesCanal > 0 ? totalRevenueCanal / totalClassesCanal : null;

  return (
    <>
      <ChartCard
        title={title}
        dateRange={
          view === "fuente"
            ? dateRange
            : (months.length > 0 ? `${periodLabel(months[0], period)} – ${periodLabel(months[months.length - 1], period)}` : undefined)
        }
        kpiItems={
          view === "canal"
            ? [
                {
                  label: "€/clase media",
                  value: avgPerClassCanal !== null ? fmtEurDecimal(avgPerClassCanal) : "-",
                  helper: `${totalClassesCanal} clases`,
                  tooltip: "Ingresos de Stripe (bruto) + Urban (real o estimado) del período ÷ total de clases realmente asistidas (Stripe no-Urban + Urban), check-ins de Momence API v2 en vivo. Es el ingreso medio real por clase mezclando ambos canales, no la tarifa pactada con Urban.",
                },
              ]
            : [
                { label: "Ventas totales", value: <ResponsiveEur value={totalBruto} />, helper: "Stripe bruto + Urban", tooltip: "Stripe bruto + Urban del período. El € de Urban se asigna al mes de las clases (Urban paga a mes vencido por transferencia); el mes aún sin facturar entra estimado: clases asistidas en Momence × tarifa pactada.", delta: ventasDelta },
                { label: "Comisión Stripe", value: <ResponsiveEur value={stripeFees} prefix="−" />, valueClassName: "text-danger", helper: `Neto: ${fmtEur(stripeNet)}`, delta: comisionDelta },
                { label: "Ventas netas", value: <ResponsiveEur value={ventasNetas} />, tooltip: "Ventas totales - comisión Stripe - IVA (extraído del bruto, no un 21% plano)", delta: netasDelta },
              ]
        }
        toolbar={
          view === "canal" ? undefined : (
            <div className="flex items-center justify-between gap-3 w-full flex-wrap">
              <ChartTypeToggle
                value={chartType}
                onChange={(v) => setChartType(v as ChartType)}
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
          )
        }
        dataSource={
          view === "fuente"
            ? "Stripe API (precio de venta, antes de comisión), en vivo. Urban Sports Club (€): el importe real son las transferencias del banco (contacto «Urban Sports»), asignadas al mes de las clases que pagan (Urban paga a mes vencido: la transferencia de mediados de julio es de las clases de junio). El mes aún sin facturar se muestra estimado = check-ins reales de Momence (API v2, en vivo) × tarifa pactada (Configuración → Tarifa Urban); al llegar su transferencia pasa al importe real."
            : view === "producto"
              ? "Stripe + Urban Sports Club. Momence no pasa qué producto se compró a Stripe: el producto se infiere comparando el importe de cada cobro con los precios conocidos (vigentes en el momento del cobro, no solo el precio de hoy). Es una estimación - un pago con cupón/descuento que coincida por casualidad con el precio de otro producto puede identificarse mal. «Urban» usa el mismo importe que la vista Fuente (banco real, o estimado en el mes aún sin facturar). Altas/bajas/reactivaciones por patrón de pagos de suscripción en Stripe."
              : "€ Stripe = ingreso bruto de Stripe (suscripciones y packs) ÷ clases asistidas (checkedIn, Momence API v2) por miembros no-Urban ese mes. € Urban = importe asignado al mes (real o estimado, ver Ventas por Fuente) ÷ clases asistidas por miembros de Urban. No compara el mismo tipo de compromiso (suscripción/pack de permanencia vs Urban por uso puntual), pero sí el ingreso real por clase de cada canal."
        }
        sources={view === "canal" ? ["stripe", "momence"] : ["stripe", "excel"]}
        lastUpdated={lastUpdated}
        aiInsight={
          view === "producto" && trendSummary.length > 0 && (
            <div className="space-y-1">
              {trendSummary.map((sentence, i) => (
                <p key={i}>{sentence}</p>
              ))}
            </div>
          )
        }
      >
        {view === "fuente" ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
              <div className="lg:col-span-3 min-w-0">
                <IngresosPorFuenteBody
                  data={grouped} chartType={chartType}
                  onBarClick={period === "mes" ? (month, source) => setSourceDrawer({ month, source }) : undefined}
                />
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
                    helper: totalBruto > 0 ? `${Math.round((s.value / totalBruto) * 100)}%` : "-",
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
                    {hasUrbanClasses && (
                      <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide whitespace-nowrap" title="Clases de Urban asistidas (check-ins de Momence, en vivo). Aún no facturado por el banco.">
                        Urban clases<span className="text-primary">*</span>
                      </th>
                    )}
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
                      <td className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                        {row.uscNet > 0 ? (
                          <span className={row.urbanIsEstimated ? "text-navy/70" : "text-navy"}>
                            {fmtEur(row.uscNet)}
                            {row.urbanIsEstimated && <span className="text-primary ml-1" title="Estimado: clases × tarifa. Aún no facturado por el banco.">est.*</span>}
                          </span>
                        ) : "-"}
                      </td>
                      {hasUrbanClasses && (
                        <td className="py-2 pr-3 text-right text-navy/70 tabular-nums">{row.urbanClasses > 0 ? row.urbanClasses : "-"}</td>
                      )}
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
                    {hasUrbanClasses && (
                      <td className="py-2 pr-3 text-right text-navy font-semibold tabular-nums">{tableUrbanClasses}</td>
                    )}
                    <td className="py-2 text-right text-navy font-semibold tabular-nums">{fmtEur(tableTotalBruto)}</td>
                  </tr>
                </tfoot>
              </table>
              {hasUrbanClasses && (
                <p className="text-[11px] text-navy/45 mt-2">
                  <span className="text-primary">est.*</span> Mes de Urban aún sin facturar: estimado = clases asistidas (check-ins reales de Momence, en vivo) × tarifa pactada. Urban paga a mes vencido, así que cada transferencia del banco se asigna al mes de las clases que paga; cuando llegue la del mes marcado, pasará a mostrar el importe real. La tarifa se configura en Configuración → Precios.
                </p>
              )}
            </CollapsibleTable>
          </>
        ) : view === "producto" ? (
          <>
            <EvolucionIngresosBody
              rows={productRows}
              keys={productKeys}
              hiddenKeys={hiddenKeys}
              hoveredLegendKey={null}
              chartType={chartType}
              view="producto"
              colorOf={colorOf}
              eventsByMonth={eventsByMonth}
              onBarClick={period === "mes" ? (month, key) => (key === "Urban" ? setSourceDrawer({ month, source: "urban" }) : setBarDrawer({ month, key })) : undefined}
              height={280}
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
                    <td className="py-2 pr-3 text-navy font-semibold whitespace-nowrap">Ventas</td>
                    {productRows.map((row) => (
                      <td key={row.month} className="py-2 pr-3 text-right text-navy font-semibold tabular-nums">
                        {fmtEur(productKeys.reduce((s, k) => s + Number(row[k] ?? 0), 0))}
                      </td>
                    ))}
                    <td className="py-2 text-right text-navy font-semibold tabular-nums">{fmtEur(legendGrandTotal)}</td>
                  </tr>
                  {productKeys.map((k) => (
                    <tr key={k} className="border-b border-navy/[0.04]">
                      <td className="py-1.5 pl-6 pr-3 text-navy/80 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorOf(k) }} />
                          {k}
                        </span>
                      </td>
                      {productRows.map((row) => (
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
          </>
        ) : (
          <>
            <StaticLegend
              className="mb-3"
              items={[
                { label: "Stripe (interno)", color: "var(--chart-violet-1)", swatch: "dot" },
                { label: "Urban Sports Club", color: "var(--color-warning)", swatch: "dot" },
              ]}
            />
            <EconomiaPorCanalBody data={channelEconomics} />
          </>
        )}
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
          {selectedUrbanSummary ? (
            <div className="p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-navy/[0.06]">
                <span className="text-navy/55">Clases asistidas</span>
                <span className="font-medium text-navy tabular-nums">{selectedUrbanSummary.classes}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-navy/[0.06]">
                <span className="text-navy/55">Importe</span>
                <span className="font-semibold text-navy tabular-nums">{fmtEur(selectedUrbanSummary.amount)}</span>
              </div>
              <p className="text-xs text-navy/45 pt-1 leading-relaxed">
                No pasa por Stripe, así que no hay pagos individuales que listar - mismo importe (banco real, o estimado en el mes aún sin facturar) que la vista Fuente.
              </p>
            </div>
          ) : selectedDrawerPayments.length === 0 ? (
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

      {sourceDrawer?.source === "stripe" && (
        <Drawer
          title="Stripe"
          subtitle={periodLabel(sourceDrawer.month, "mes")}
          onClose={() => setSourceDrawer(null)}
        >
          <div className="p-3">
            {sourceDrawerPayments.length === 0 ? (
              <p className="text-xs text-navy/45 text-center py-8">Sin pagos registrados en Stripe este mes.</p>
            ) : (
              sourceDrawerPayments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-navy/[0.06] last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-navy truncate">{p.customerName ?? "Sin nombre"}</p>
                    <p className="text-[11px] text-navy/45 truncate">{p.customerEmail ?? p.date} · {p.inferredProduct}</p>
                  </div>
                  <p className="text-xs font-semibold text-navy shrink-0">{fmtEur(p.amount)}</p>
                </div>
              ))
            )}
          </div>
        </Drawer>
      )}

      {sourceDrawer?.source === "urban" && sourceDrawerUrbanRow && (
        <Drawer
          title="Urban Sports Club"
          subtitle={periodLabel(sourceDrawer.month, "mes")}
          onClose={() => setSourceDrawer(null)}
        >
          <div className="p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-navy/[0.06]">
              <span className="text-navy/55">Clases asistidas</span>
              <span className="font-medium text-navy tabular-nums">{sourceDrawerUrbanRow.urbanClasses}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-navy/[0.06]">
              <span className="text-navy/55">Importe</span>
              <span className="font-semibold text-navy tabular-nums">{fmtEur(sourceDrawerUrbanRow.uscNet)}</span>
            </div>
            <p className="text-xs text-navy/45 pt-1 leading-relaxed">
              {sourceDrawerUrbanRow.urbanIsEstimated
                ? "Estimado: clases asistidas × tarifa pactada vigente (Configuración → Precios). Urban paga a mes vencido; al llegar su transferencia este importe pasará a ser el real."
                : "Importe real: transferencia del banco de Urban Sports Club, asignada al mes de las clases que paga."}
            </p>
          </div>
        </Drawer>
      )}
    </>
  );
}
