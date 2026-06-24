"use client";

import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, type TooltipContentProps } from "recharts";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { MonthlySubStats } from "@/lib/subscriptionCohort";
import { Legend } from "@/components/charts";

const COLORS = ["#6B7ED6", "#9260B8", "#D4AA35", "#4A7A9B", "#4A9870", "#D46055", "#C46890", "#3AA09C", "#8878C0"];

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

export default function EvolucionSuscripcionesBody({
  monthly,
  cohorts,
}: {
  monthly: MonthlyProductRevenue[];
  cohorts: MonthlySubStats[];
}) {
  if (monthly.length === 0) {
    return <p className="text-sm text-navy/45 text-center py-10">Sin datos suficientes</p>;
  }

  const allItems = Array.from(new Set(monthly.flatMap((m) => m.items.map((i) => i.name))));
  const colorOf = (name: string) => COLORS[allItems.indexOf(name) % COLORS.length];
  const cohortByMonth = new Map(cohorts.map((c) => [c.month, c]));

  const data = monthly.map((m) => {
    const row: Record<string, string | number> = { month: m.month, label: m.label, total: m.total };
    for (const item of m.items) row[item.name] = item.revenue;
    return row;
  });

  function ChartTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as { month: string; label: string; total: number };
    const c = cohortByMonth.get(row.month);
    return (
      <div className="bg-white border border-navy/[0.07] rounded-lg shadow-card px-3 py-2 text-xs">
        <p className="font-semibold text-navy mb-1">{row.label}</p>
        <p className="text-navy/55 mb-1">{fmtEur(row.total)}</p>
        {c && (
          <div className="flex gap-2">
            <span className="text-success">+{c.newSubs} altas</span>
            <span className="text-danger">−{c.churned} bajas</span>
            <span className="text-primary">{c.reactivated} react.</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Legend items={allItems.map((name) => ({ label: name, color: colorOf(name) }))} className="mb-3" />

      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="4 3" stroke="rgba(28,25,23,0.07)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} width={34} />
            <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(28,25,23,0.04)" }} />
            {allItems.map((name) => (
              <Bar key={name} dataKey={name} stackId="rev" fill={colorOf(name)} radius={0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr className="border-b border-navy/[0.07]">
              <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Mes</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Ingresos</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Suscriptores</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Altas</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Bajas</th>
              <th className="text-right py-2 text-navy/45 font-semibold uppercase tracking-wide">Reactiv.</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => {
              const c = cohortByMonth.get(m.month);
              return (
                <tr key={m.month} className="border-b border-navy/[0.04] last:border-0">
                  <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">{m.label}</td>
                  <td className="py-2 pr-3 text-right text-navy tabular-nums">{fmtEur(m.total)}</td>
                  <td className="py-2 pr-3 text-right text-navy tabular-nums">{c?.activeCount ?? "—"}</td>
                  <td className="py-2 pr-3 text-right text-success font-medium tabular-nums">{c ? `+${c.newSubs}` : "—"}</td>
                  <td className="py-2 pr-3 text-right text-danger font-medium tabular-nums">{c ? `−${c.churned}` : "—"}</td>
                  <td className="py-2 text-right text-primary font-medium tabular-nums">{c?.reactivated ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
