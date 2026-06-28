"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import { ChartCard, ToggleGroup, ChartTypeToggle, type MultiKpiItem } from "@/components/charts";
import GastosResumenGeneral, { GROUP_LABELS, GROUP_COLORS, GROUP_ORDER, type GroupTotal, fmtAmount } from "../GastosResumenGeneral";
import { regroupSeries, periodLabel, buildGroupSeries, type Period } from "./evolucionIngresosUtils";
import type { EconomicGroup } from "@/lib/transactions";

const EvolucionGastosBody = dynamic(() => import("./EvolucionGastosBody"), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

const PERIODS: { key: Period; label: string }[] = [
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año", label: "Año" },
];

export default function DesglosGastosGeneral({
  groups,
  totalExpCat,
  rangeLabel,
}: {
  groups: GroupTotal[];
  totalExpCat: number;
  rangeLabel?: string | null;
}) {
  const [period, setPeriod] = useState<Period>("mes");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [hiddenGroups, setHiddenGroups] = useState<Set<EconomicGroup>>(new Set());

  const toggleHidden = (group: EconomicGroup) =>
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  const kpiItems: MultiKpiItem[] = [{ label: "Total gastos", value: fmtAmount(totalExpCat) }];

  const base = buildGroupSeries(groups);
  const { months, data } = regroupSeries(base.months, base.data, period);

  return (
    <ChartCard
      title="Desglose de gastos: visión general"
      subtitle="Personal, gasto operativo (OpEx) e inversión (CapEx), sin mezclar partidas"
      dateRange={rangeLabel ?? undefined}
      kpiItems={kpiItems}
      toolbar={
        <div className="flex justify-end items-center gap-2 w-full">
          <ChartTypeToggle
            value={chartType}
            onChange={(v) => setChartType(v as "bar" | "line")}
            options={[
              { value: "bar", label: "Ver como barras", icon: <BarChart2 size={14} /> },
              { value: "line", label: "Ver como línea", icon: <Activity size={14} /> },
            ]}
          />
          <ToggleGroup
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </div>
      }
      dataSource="Exportación bancaria CaixaBank · excluye aportaciones de socios y préstamo"
      sources={["excel"]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 min-w-0">
          <EvolucionGastosBody groups={groups} period={period} hiddenGroups={hiddenGroups} chartType={chartType} />
        </div>
        <div className="lg:col-span-1 min-w-0">
          <p className="text-xs font-medium text-navy/55 mb-2.5">Resumen</p>
          <GastosResumenGeneral
            groups={groups}
            totalExpCat={totalExpCat}
            hiddenGroups={hiddenGroups}
            onToggleHidden={toggleHidden}
          />
        </div>
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
    </ChartCard>
  );
}
