"use client";

import {
  ResponsiveContainer, ComposedChart, Bar, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  type TooltipContentProps,
} from "recharts";
import type { EconomicGroup } from "@/lib/transactions";
import type { GroupTotal } from "../GastosResumenGeneral";
import { GROUP_LABELS, GROUP_COLORS, GROUP_ORDER, fmtAmount } from "../GastosResumenGeneral";
import { regroupSeries, periodLabel, buildGroupSeries, type Period } from "./evolucionIngresosUtils";

type Row = { month: string; label: string } & Record<EconomicGroup, number>;

function fmtTick(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${Math.round(v)}`;
}

function makeTooltip(visibleGroups: EconomicGroup[]) {
  return function GastosTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as Row;
    return (
      <div className="bg-card border border-border rounded-[10px] shadow-lg px-3 py-2 text-xs min-w-[170px]">
        <p className="font-semibold text-navy mb-1.5">{row.label}</p>
        {visibleGroups.map((g) => (
          <div key={g} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: GROUP_COLORS[g] }} />
            <span className="text-navy/55 truncate">{GROUP_LABELS[g]}</span>
            <span className="font-semibold text-navy ml-auto whitespace-nowrap">{fmtAmount(Number(row[g] ?? 0))}</span>
          </div>
        ))}
      </div>
    );
  };
}

export default function EvolucionGastosBody({
  groups,
  period,
  hiddenGroups,
  chartType = "bar",
}: {
  groups: GroupTotal[];
  period: Period;
  hiddenGroups?: Set<EconomicGroup>;
  chartType?: "bar" | "line";
}) {
  const base = buildGroupSeries(groups);
  const { months, data } = regroupSeries(base.months, base.data, period);
  const visibleGroups = GROUP_ORDER.filter((g) => !hiddenGroups?.has(g));

  const rows: Row[] = months.map((m) => {
    const row = { month: m, label: periodLabel(m, period) } as Row;
    for (const g of GROUP_ORDER) row[g] = data.get(m)?.get(g) ?? 0;
    return row;
  });

  if (rows.length === 0) {
    return <p className="text-sm text-navy/45 text-center py-10">Sin datos de gastos</p>;
  }

  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="4 3" stroke="color-mix(in srgb, var(--color-navy) 7%, transparent)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "color-mix(in srgb, var(--color-navy) 45%, transparent)" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtTick} tick={{ fontSize: 10, fill: "color-mix(in srgb, var(--color-navy) 45%, transparent)" }} tickLine={false} axisLine={false} width={34} />
          <Tooltip
            content={makeTooltip(visibleGroups)}
            cursor={chartType === "bar" ? { fill: "color-mix(in srgb, var(--color-navy) 4%, transparent)" } : { stroke: "color-mix(in srgb, var(--color-navy) 20%, transparent)", strokeDasharray: "4 3" }}
          />
          {chartType === "bar"
            ? visibleGroups.map((g) => (
                <Bar key={g} dataKey={g} stackId="a" fill={GROUP_COLORS[g]} radius={[2, 2, 0, 0]} />
              ))
            : visibleGroups.map((g) => (
                <Line
                  key={g}
                  type="monotone"
                  dataKey={g}
                  stroke={GROUP_COLORS[g]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: GROUP_COLORS[g], stroke: "white", strokeWidth: 1.5 }}
                  activeDot={{ r: 4.5 }}
                />
              ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
