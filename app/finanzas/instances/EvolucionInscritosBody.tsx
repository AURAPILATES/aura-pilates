"use client";

import { ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip, LabelList, type TooltipContentProps } from "recharts";

export type InscritosRow = { month: string; label: string; count: number };

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as InscritosRow;
  return (
    <div className="bg-white border border-navy/[0.07] rounded-lg shadow-card px-3 py-2 text-xs">
      <p className="font-semibold text-navy">{row.label}</p>
      <p className="text-navy/55">{row.count} clientes activos</p>
    </div>
  );
}

export default function EvolucionInscritosBody({ data }: { data: InscritosRow[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-navy/45 text-center py-10">Sin datos suficientes</p>;
  }

  const lastMonth = data[data.length - 1].month;

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="4 3" stroke="rgba(28,25,23,0.07)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} width={28} />
          <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(28,25,23,0.04)" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 500, fill: "#1c1917" }} />
            {data.map((d) => (
              <Cell key={d.month} fill={d.month === lastMonth ? "#7F77DD" : "#AFA9EC"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
