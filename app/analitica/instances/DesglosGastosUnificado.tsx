"use client";

import { useState, type ReactElement } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BarChart2, Activity, Eye, EyeOff, ChevronRight, ChevronDown } from "react-feather";
import { ChartCard, ChartTypeToggle, ToggleGroup, CollapsibleTable, type MultiKpiItem } from "@/components/charts";
import { pct } from "@/lib/analytics";
import Drawer from "@/app/components/Drawer";
import { CategoryIcon } from "../GastosBreakdown";
import { GROUP_LABELS, GROUP_COLORS, GROUP_ORDER, type GroupTotal, fmtAmount } from "../GastosResumenGeneral";
import { regroupSeries, periodLabel, periodKey, buildGroupSeries, type Period } from "./evolucionIngresosUtils";
import type { EconomicGroup } from "@/lib/transactions";
import type { TopExpenseSeg, LeafExpenseSeg } from "../AnaliticaLoader";

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

type Selected =
  | { kind: "category"; group: EconomicGroup; seg: TopExpenseSeg }
  | { kind: "subcategory"; group: EconomicGroup; parent: TopExpenseSeg; leaf: LeafExpenseSeg };

function fmtDate(d: string) {
  return d.split("-").reverse().join("/");
}

/** Suma por período (mes/trimestre/año) de un conjunto de transacciones, alineado a las
 * mismas claves de período que ya usa el gráfico de evolución (buildGroupSeries+regroupSeries). */
function rowSeriesByPeriod(txns: Txn[], period: Period): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const t of txns) {
    const m = t.date.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + Math.abs(t.amount));
  }
  const byPeriod = new Map<string, number>();
  for (const [m, v] of byMonth) {
    const k = periodKey(m, period);
    byPeriod.set(k, (byPeriod.get(k) ?? 0) + v);
  }
  return byPeriod;
}

/** Prueba "todo en horizontal" (mismo patrón que EvolucionSuscripcionesFullWidth) aplicada
 * a gastos: unifica "visión general" y "personal y operativo" en una sola card, con el
 * desglose por categoría/subcategoría como acordeón en vez de un segundo gráfico aparte. */
export default function DesglosGastosUnificado({
  groups,
  categories,
  transactionsByCategory,
  totalExpCat,
  totalExpCatNoCapex,
  rangeLabel,
}: {
  groups: GroupTotal[];
  categories: TopExpenseSeg[];
  transactionsByCategory: Record<string, Txn[]>;
  totalExpCat: number;
  totalExpCatNoCapex: number;
  rangeLabel?: string | null;
}) {
  const [period, setPeriod] = useState<Period>("mes");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [hiddenGroups, setHiddenGroups] = useState<Set<EconomicGroup>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<EconomicGroup>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [tableExpanded, setTableExpanded] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);

  const toggleHidden = (group: EconomicGroup) =>
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  const toggleExpandedGroup = (group: EconomicGroup) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  const toggleExpandedCategory = (key: string) =>
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const base = buildGroupSeries(groups);
  const { months, data } = regroupSeries(base.months, base.data, period);

  const capexGroup = groups.find((g) => g.group === "capex");
  const capexShare = totalExpCat > 0 && capexGroup ? capexGroup.total / totalExpCat : 0;
  const insight =
    capexShare > 0.3
      ? [
          `La inversión (CapEx) representa el ${pct(capexShare)} del total y no se repetirá cada mes.`,
        ]
      : [];

  const kpiItems: MultiKpiItem[] = [
    { label: "Total período", value: fmtAmount(totalExpCat) },
    { label: "Coste operativo", value: fmtAmount(totalExpCatNoCapex), helper: "Personal + OpEx · excluye CapEx" },
  ];

  function categoryTxns(seg: TopExpenseSeg): Txn[] {
    return [...(transactionsByCategory[seg.key] ?? []), ...seg.children.flatMap((ch) => transactionsByCategory[ch.value] ?? [])];
  }

  const selectedInfo =
    selected?.kind === "category"
      ? { label: selected.seg.label, color: selected.seg.color, iconKey: selected.seg.iconKey, total: selected.seg.total, count: selected.seg.count }
      : selected?.kind === "subcategory"
        ? { label: selected.leaf.label, color: selected.leaf.color, iconKey: selected.leaf.iconKey, total: selected.leaf.total, count: selected.leaf.count }
        : null;

  const openableGroups = GROUP_ORDER.filter((group) => {
    const g = groups.find((x) => x.group === group);
    return !!g && g.total > 0;
  });
  const openableCategories = categories.filter((c) => c.children.length > 0).map((c) => c.key);
  const allResumenExpanded =
    openableGroups.length > 0 &&
    openableGroups.every((g) => expandedGroups.has(g)) &&
    openableCategories.every((k) => expandedCategories.has(k));

  function toggleAllResumen() {
    if (allResumenExpanded) {
      setExpandedGroups(new Set());
      setExpandedCategories(new Set());
    } else {
      setExpandedGroups(new Set(openableGroups));
      setExpandedCategories(new Set(openableCategories));
    }
  }

  const selectedTxns = selected
    ? (selected.kind === "category" ? categoryTxns(selected.seg) : (transactionsByCategory[selected.leaf.value] ?? []))
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <ChartCard
      title="Desglose de gastos"
      subtitle="Personal, gasto operativo (OpEx) e inversión (CapEx), con detalle por categoría y subcategoría"
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

      {/* ── Resumen: acordeón Grupo → Categoría → Subcategoría ──────────────── */}
      <div className="flex items-center gap-2 mt-5 mb-2.5">
        <p className="text-xs font-medium text-navy/55">Resumen</p>
        <button
          type="button"
          onClick={toggleAllResumen}
          className="flex items-center gap-0.5 text-xs font-medium text-navy/40 hover:text-navy/70 transition-colors"
        >
          <ChevronDown size={11} className={`transition-transform duration-200 ${allResumenExpanded ? "rotate-180" : ""}`} />
          {allResumenExpanded ? "Contraer" : "Desglosar"}
        </button>
      </div>
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
                  onClick={() => toggleExpandedGroup(group)}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                >
                  <ChevronRight
                    size={13}
                    className={`shrink-0 text-navy/35 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: GROUP_COLORS[group] }} />
                  <span className={`text-[13px] font-semibold text-navy truncate ${isHidden ? "line-through" : ""}`}>
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
                <div className="pl-6 space-y-0.5">
                  {groupCategories.map((c) => {
                    const childShare = g.total > 0 ? c.total / g.total : 0;
                    const hasChildren = c.children.length > 0;
                    const catOpen = expandedCategories.has(c.key);
                    return (
                      <div key={c.key}>
                        <button
                          type="button"
                          onClick={() => setSelected({ kind: "category", group, seg: c })}
                          className="w-full flex items-center gap-1.5 py-1.5 text-left rounded-lg px-2 -mx-2 hover:bg-navy/[0.02] transition-colors"
                        >
                          {hasChildren ? (
                            <span
                              onClick={(e) => { e.stopPropagation(); toggleExpandedCategory(c.key); }}
                              className="shrink-0 w-4 h-4 flex items-center justify-center text-navy/35 hover:text-navy/60 transition-colors"
                            >
                              <ChevronRight size={11} className={`transition-transform ${catOpen ? "rotate-90" : ""}`} />
                            </span>
                          ) : (
                            <span className="shrink-0 w-4 h-4" />
                          )}
                          <CategoryIcon name={c.label} color={c.color} iconKey={c.iconKey} small />
                          <span className="flex-1 min-w-0 text-[12.5px] font-medium text-navy truncate">{c.label}</span>
                          <span className="text-[12.5px] text-navy tabular-nums text-right shrink-0 w-20">{fmtAmount(c.total)}</span>
                          <span className="text-[11px] text-navy/50 tabular-nums text-right shrink-0 w-9">{pct(childShare)}</span>
                        </button>

                        {hasChildren && catOpen && (
                          <div className="pl-7 space-y-0.5">
                            {c.children.map((ch) => {
                              const leafShare = c.total > 0 ? ch.total / c.total : 0;
                              return (
                                <button
                                  key={ch.value}
                                  type="button"
                                  onClick={() => setSelected({ kind: "subcategory", group, parent: c, leaf: ch })}
                                  className="w-full flex items-center gap-1.5 py-1.5 text-left rounded-lg px-2 -mx-2 hover:bg-navy/[0.02] transition-colors"
                                >
                                  <CategoryIcon name={ch.label} color={ch.color} iconKey={ch.iconKey} small />
                                  <span className="flex-1 min-w-0 text-[11.5px] text-navy/75 truncate">{ch.label}</span>
                                  <span className="text-[11.5px] text-navy/75 tabular-nums text-right shrink-0 w-20">{fmtAmount(ch.total)}</span>
                                  <span className="text-[10.5px] text-navy/45 tabular-nums text-right shrink-0 w-9">{pct(leafShare)}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <CollapsibleTable>
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr className="border-b border-navy/[0.07]">
              <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">
                <span className="flex items-center gap-2">
                  Categoría
                  <button
                    type="button"
                    onClick={() => setTableExpanded((v) => !v)}
                    className="flex items-center gap-0.5 normal-case font-medium text-navy/40 hover:text-navy/70 transition-colors"
                  >
                    <ChevronDown size={11} className={`transition-transform duration-200 ${tableExpanded ? "rotate-180" : ""}`} />
                    {tableExpanded ? "Contraer datos" : "Desplegar datos"}
                  </button>
                </span>
              </th>
              {months.map((m) => (
                <th key={m} className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide whitespace-nowrap">
                  {periodLabel(m, period)}
                </th>
              ))}
              <th className="text-right py-2 text-navy/45 font-semibold uppercase tracking-wide">Total</th>
            </tr>
          </thead>
          <tbody>
            {GROUP_ORDER.map((group) => {
              const g = groups.find((x) => x.group === group);
              if (!g || g.total <= 0) return null;
              const isOpen = tableExpanded;
              const groupCategories = categories.filter((c) => c.group === group).sort((a, b) => b.total - a.total);

              const rows: { jsx: ReactElement }[] = [];

              rows.push({
                jsx: (
                  <tr key={`g-${group}`} className="border-b border-navy/[0.04] bg-navy/[0.025]">
                    <td className="py-2 pr-3 text-navy font-semibold whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: GROUP_COLORS[group] }} />
                        {GROUP_LABELS[group]}
                      </span>
                    </td>
                    {months.map((m) => (
                      <td key={m} className="py-2 pr-3 text-right text-navy font-semibold tabular-nums">
                        {data.get(m)?.get(group) ? fmtAmount(data.get(m)!.get(group)!) : "-"}
                      </td>
                    ))}
                    <td className="py-2 text-right text-navy font-semibold tabular-nums">{fmtAmount(g.total)}</td>
                  </tr>
                ),
              });

              if (isOpen) {
                for (const c of groupCategories) {
                  const catSeries = rowSeriesByPeriod(categoryTxns(c), period);
                  rows.push({
                    jsx: (
                      <tr key={`c-${c.key}`} className="border-b border-navy/[0.04]">
                        <td className="py-1.5 pl-6 pr-3 text-navy/80 whitespace-nowrap">{c.label}</td>
                        {months.map((m) => (
                          <td key={m} className="py-1.5 pr-3 text-right text-navy/80 tabular-nums">
                            {catSeries.get(m) ? fmtAmount(catSeries.get(m)!) : "-"}
                          </td>
                        ))}
                        <td className="py-1.5 text-right text-navy/80 tabular-nums">{fmtAmount(c.total)}</td>
                      </tr>
                    ),
                  });

                  if (tableExpanded) {
                    for (const ch of c.children) {
                      const leafSeries = rowSeriesByPeriod(transactionsByCategory[ch.value] ?? [], period);
                      rows.push({
                        jsx: (
                          <tr key={`l-${ch.value}`} className="border-b border-navy/[0.04] last:border-0">
                            <td className="py-1.5 pl-11 pr-3 text-navy/55 whitespace-nowrap">{ch.label}</td>
                            {months.map((m) => (
                              <td key={m} className="py-1.5 pr-3 text-right text-navy/55 tabular-nums">
                                {leafSeries.get(m) ? fmtAmount(leafSeries.get(m)!) : "-"}
                              </td>
                            ))}
                            <td className="py-1.5 text-right text-navy/55 tabular-nums">{fmtAmount(ch.total)}</td>
                          </tr>
                        ),
                      });
                    }
                  }
                }
              }

              return rows.map((r) => r.jsx);
            })}
          </tbody>
        </table>
      </CollapsibleTable>

      {selected && selectedInfo && (
        <Drawer
          maxWidth="max-w-[420px]"
          header={
            <div className="flex items-center gap-3">
              <CategoryIcon name={selectedInfo.label} color={selectedInfo.color} iconKey={selectedInfo.iconKey} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-navy">{selectedInfo.label}</h2>
                <p className="text-xs text-navy/55 mt-0.5">{fmtAmount(selectedInfo.total)} · {selectedInfo.count} transacciones</p>
              </div>
            </div>
          }
          footer={
            <Link
              href={`/transacciones?categoria=${encodeURIComponent(selected.kind === "category" ? selected.seg.key : selected.leaf.value)}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-navy/20 bg-white text-sm font-medium text-navy hover:border-navy/40 transition-colors"
            >
              Ver transacciones
            </Link>
          }
          onClose={() => setSelected(null)}
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
