"use client";

import { ResponsiveContainer, ComposedChart, Bar, Line, CartesianGrid, XAxis, YAxis, Tooltip, LabelList, type TooltipContentProps } from "recharts";

export type VolumenBrutoRow = { key: string; label: string; income: number; expense: number };

const INCOME_COLOR = "#818CF8";
const EXPENSE_COLOR = "#FCA5A5";

function fmtTick(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;
}

function fmtLabel(v: unknown) {
  const n = Number(v);
  if (!n) return "";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as VolumenBrutoRow;
  return (
    <div className="bg-white border border-[#e6e6ea] rounded-[10px] shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-navy mb-1.5">{row.label}</p>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} />
        <span className="text-navy/55">Ingresos</span>
        <span className="font-semibold text-navy ml-auto">{fmtEur(row.income)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} />
        <span className="text-navy/55">Gastos</span>
        <span className="font-semibold text-navy ml-auto">{fmtEur(row.expense)}</span>
      </div>
    </div>
  );
}

export default function VolumenBrutoBody({ data, chartType }: { data: VolumenBrutoRow[]; chartType: "bar" | "line" }) {
  if (data.length === 0) {
    return <p className="text-sm text-navy/45 text-center py-10">Sin datos para este período</p>;
  }

  return (
    <div style={{ width: "100%", height: 250 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="4 3" stroke="rgba(28,25,23,0.07)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtTick} tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} width={34} />
          <Tooltip content={ChartTooltip} cursor={chartType === "bar" ? { fill: "rgba(28,25,23,0.04)" } : { stroke: "rgba(28,25,23,0.2)", strokeDasharray: "4 3" }} />
          {chartType === "bar" ? (
            <>
              <Bar dataKey="income" fill={INCOME_COLOR} radius={[3, 3, 0, 0]}>
                <LabelList dataKey="income" position="top" formatter={fmtLabel} style={{ fontSize: 10, fill: INCOME_COLOR, fontWeight: 600 }} />
              </Bar>
              <Bar dataKey="expense" fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]}>
                <LabelList dataKey="expense" position="top" formatter={fmtLabel} style={{ fontSize: 10, fill: EXPENSE_COLOR, fontWeight: 600 }} />
              </Bar>
            </>
          ) : (
            <>
              <Line type="monotone" dataKey="income" stroke={INCOME_COLOR} strokeWidth={2} dot={{ r: 3, fill: INCOME_COLOR, stroke: "white", strokeWidth: 1.5 }} activeDot={{ r: 4.5 }} />
              <Line type="monotone" dataKey="expense" stroke={EXPENSE_COLOR} strokeWidth={2} dot={{ r: 3, fill: EXPENSE_COLOR, stroke: "white", strokeWidth: 1.5 }} activeDot={{ r: 4.5 }} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
