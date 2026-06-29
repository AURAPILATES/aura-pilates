"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BarChart2, Activity, Eye, EyeOff, ChevronRight } from "react-feather";
import { ChartCard, ChartTypeToggle, ToggleGroup, type MultiKpiItem } from "@/components/charts";
import { pct } from "@/lib/analytics";
import Drawer from "@/app/components/Drawer";
import { CategoryIcon } from "../GastosBreakdown";
import { GROUP_LABELS, GROUP_COLORS, GROUP_ORDER, type GroupTotal, fmtAmount } from "../GastosResumenGeneral";
import { regroupSeries, periodLabel, buildGroupSeries, type Period } from "./evolucionIngresosUtils";
import type { EconomicGroup } from "@/lib/transactions";
import type { TopExpenseSeg } from "../AnaliticaLoader";

const EvolucionGastosBody = dynamic(() => import("./EvolucionGastosBody"), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

const PERIODS: { key: Period; label: string }[] = [
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año", label: "Año" },
];

type Txn = { date: string; amount: number; concept: string; contact: string };

function fmtDate(d: string) {
  return d.split("-").reverse().join("/");
}

/** Prueba "todo en horizontal" (mismo patrón que EvolucionSuscripcionesFullWidth) aplicada
 * a gastos: unifica "visión general" y "personal y operativo" en una sola card, con el
 * desglose por categoría como acordeón en vez de un segundo gráfico aparte. */
export default function DesglosGastosUnificado({
  groups,
  categories,
  transactionsByCategory,
  totalExpCat,
  totalExpCatNoCapex,
  avgMonthlyBurn,
  rangeLabel,
}: {
  groups: GroupTotal[];
  categories: TopExpenseSeg[];
  transactionsByCategory: Record<string, Txn[]>;
  totalExpCat: number;
  totalExpCatNoCapex: number;
  avgMonthlyBurn: number;
  rangeLabel?: string | null;
}) {
  const [period, setPeriod] = useState<Period>("mes");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [hiddenGroups, setHiddenGroups] = useState<Set<EconomicGroup>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<EconomicGroup>>(new Set());
  const [selectedLeaf, setSelectedLeaf] = useState<TopExpenseSeg | null>(null);

  const toggleHidden = (group: EconomicGroup) =>
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  const toggleExpanded = (group: EconomicGroup) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  const base = buildGroupSeries(groups);
  const { months, data } = regroupSeries(base.months, base.data, period);

  const capexGroup = groups.find((g) => g.group === "capex");
  const capexShare = totalExpCat > 0 && capexGroup ? capexGroup.total / totalExpCat : 0;
  const insight =
    capexShare > 0.3
      ? [
          `La inversión (CapEx) representa el ${pct(capexShare)} del total y no se repetirá cada mes — el coste operativo recurrente real es ${fmtAmount(avgMonthlyBurn)}/mes (Personal + OpEx).`,
        ]
      : [];

  const kpiItems: MultiKpiItem[] = [
    { label: "Total período", value: fmtAmount(totalExpCat) },
    { label: "Coste operativo", value: fmtAmount(totalExpCatNoCapex), helper: "Personal + OpEx · excluye CapEx" },
    { label: "Promedio mensual coste operativo", value: `${fmtAmount(avgMonthlyBurn)}/mes`, helper: "Personal + OpEx · últ. 3 meses completos" },
  ];

  const selectedTxns = selectedLeaf
    ? [...(transactionsByCategory[selectedLeaf.key] ?? []), ...selectedLeaf.children.flatMap((ch) => transactionsByCategory[ch.value] ?? [])]
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <ChartCard
      title="Desglose de gastos (prueba — full width)"
      subtitle="Personal, gasto operativo (OpEx) e inversión (CapEx), con detalle por categoría"
      dateRange={rangeLabel ?? undefined}
      kpiItems={kpiItems}
      toolbar={
        <>
          <ChartTypeToggle
            value={chartType}
            onChange={(v) => setChartType(v as "bar" | "line")}
            options={[
              { value: "bar", label: "Ver como barras", icon: <BarChart2 size={14} /> },
              { value: "line", label: "Ver como línea", icon: <Activity size={14} /> },
            ]}
          />
          <div className="ml-auto">
            <ToggleGroup
              value={period}
              onChange={(v) => setPeriod(v as Period)}
              options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
            />
          </div>
        </>
      }
      dataSource="Exportación bancaria CaixaBank · excluye aportaciones de socios y préstamo"
      sources={["excel"]}
      aiInsight={
        insight.length > 0 && (
          <div className="space-y-1">
            {insight.map((sentence, i) => <p key={i}>{sentence}</p>)}
          </div>
        )
      }
    >
      <EvolucionGastosBody groups={groups} period={period} hiddenGroups={hiddenGroups} chartType={chartType} />

      <p className="text-xs font-medium text-navy/55 mt-5 mb-2.5">Resumen</p>
      <div className="space-y-1">
        {GROUP_ORDER.map((group) => {
          const g = groups.find((x) => x.group === group);
          if (!g || g.total <= 0) return null;
          const share = totalExpCat > 0 ? g.total / totalExpCat : 0;
          const isOpen = expandedGroups.has(group);
          const isHidden = hiddenGroups.has(group);
          const groupCategories = categories.filter((c) => c.group === group).sort((a, b) => b.total - a.total);

          return (
            <div key={group}>
              <div
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
                  isHidden ? "opacity-40" : "hover:bg-navy/[0.02]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(group)}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                >
                  <ChevronRight
                    size={13}
                    className={`shrink-0 text-navy/35 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: GROUP_COLORS[group] }} />
                  <span className={`text-[13px] font-medium text-navy truncate ${isHidden ? "line-through" : ""}`}>
                    {GROUP_LABELS[group]}
                  </span>
                </button>
                <span className="text-[13px] font-semibold text-navy tabular-nums text-right shrink-0 w-24">{fmtAmount(g.total)}</span>
                <span className="text-xs text-navy/50 tabular-nums text-right shrink-0 w-10">{pct(share)}</span>
                <button
                  type="button"
                  onClick={() => toggleHidden(group)}
                  aria-pressed={!isHidden}
                  title={isHidden ? "Mostrar en el gráfico" : "Ocultar en el gráfico"}
                  className="shrink-0 p-1 rounded-full text-navy/35 hover:text-navy hover:bg-navy/[0.06] transition-colors"
                >
                  {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>

              {isOpen && (
                <div className="pl-6 pb-1 space-y-0.5">
                  {groupCategories.map((c) => {
                    const childShare = g.total > 0 ? c.total / g.total : 0;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setSelectedLeaf(c)}
                        className="w-full flex items-center gap-2 py-1.5 text-left rounded-lg px-2 -mx-2 hover:bg-navy/[0.02] transition-colors"
                      >
                        <CategoryIcon name={c.label} color={c.color} iconKey={c.iconKey} small />
                        <span className="flex-1 min-w-0 text-[12px] font-medium text-navy/90 truncate">{c.label}</span>
                        <span className="text-[12px] text-navy tabular-nums text-right shrink-0 w-20">{fmtAmount(c.total)}</span>
                        <span className="text-[11px] text-navy/50 tabular-nums text-right shrink-0 w-9">{pct(childShare)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr className="border-b border-navy/[0.07]">
              <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Período</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Total</th>
              {GROUP_ORDER.map((g) => (
                <th key={g} className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide whitespace-nowrap">
                  {GROUP_LABELS[g]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => {
              const row = data.get(m);
              const total = GROUP_ORDER.reduce((s, g) => s + (row?.get(g) ?? 0), 0);
              return (
                <tr key={m} className="border-b border-navy/[0.04] last:border-0">
                  <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">{periodLabel(m, period)}</td>
                  <td className="py-2 pr-3 text-right text-navy font-medium tabular-nums">{fmtAmount(total)}</td>
                  {GROUP_ORDER.map((g) => (
                    <td key={g} className="py-2 pr-3 text-right text-navy tabular-nums">
                      {row?.get(g) ? fmtAmount(row.get(g)!) : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedLeaf && (
        <Drawer
          maxWidth="max-w-[420px]"
          header={
            <div className="flex items-center gap-3">
              <CategoryIcon name={selectedLeaf.label} color={selectedLeaf.color} iconKey={selectedLeaf.iconKey} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-navy">{selectedLeaf.label}</h2>
                <p className="text-xs text-navy/55 mt-0.5">{fmtAmount(selectedLeaf.total)} · {selectedLeaf.count} transacciones</p>
              </div>
            </div>
          }
          footer={
            <Link
              href={`/transacciones?categoria=${encodeURIComponent(selectedLeaf.key)}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-navy/20 bg-white text-sm font-medium text-navy hover:border-navy/40 transition-colors"
            >
              Ver transacciones
            </Link>
          }
          onClose={() => setSelectedLeaf(null)}
        >
          {selectedTxns.length === 0 ? (
            <p className="text-sm text-navy/45 px-6 py-8">Sin transacciones registradas.</p>
          ) : (
            selectedTxns.map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3.5 border-b border-navy/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{t.contact || t.concept}</p>
                  <p className="text-xs text-navy/55 mt-0.5">{fmtDate(t.date)}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0 text-navy">{fmtAmount(Math.abs(t.amount))}</p>
              </div>
            ))
          )}
        </Drawer>
      )}
    </ChartCard>
  );
}
