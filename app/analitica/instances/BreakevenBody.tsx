"use client";

import {
  ResponsiveContainer, ComposedChart, Line, Area, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine,
  type TooltipContentProps,
} from "recharts";
import type { BreakevenPoint } from "@/lib/breakeven";

type View = "bruto" | "neto";

function fmtTick(v: number) {
  const abs = Math.abs(v);
  return abs >= 1000 ? `${v < 0 ? "−" : ""}${(abs / 1000).toFixed(0)}k` : `${v}`;
}

function fmtEur(v: number) {
  const sign = v < 0 ? "−" : "";
  return sign + Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

function makeTooltip(view: View) {
  return function BreakevenTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as BreakevenPoint;
    return (
      <div className="bg-card border border-border rounded-[10px] shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold text-navy mb-1.5">{p.label}</p>
        {view === "bruto" ? (
          <>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-navy/55">Ingresos</span>
              <span className="font-semibold text-navy ml-auto">{fmtEur(p.cumRevenue)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-danger" />
              <span className="text-navy/55">Gastos</span>
              <span className="font-semibold text-navy ml-auto">{fmtEur(p.cumExpenses)}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${p.cumNet >= 0 ? "bg-success" : "bg-danger"}`} />
            <span className="text-navy/55">Resultado neto</span>
            <span className="font-semibold text-navy ml-auto">{fmtEur(p.cumNet)}</span>
          </div>
        )}
      </div>
    );
  };
}

export default function BreakevenBody({ points, view }: { points: BreakevenPoint[]; view: View }) {
  if (points.length === 0) {
    return <p className="text-sm text-navy/45 text-center py-10">Sin datos suficientes</p>;
  }

  const breakevenIdx = points.findIndex((p) => p.cumNet >= 0);
  const isBreakeven = breakevenIdx !== -1;
  const data = points.map((p) => ({
    ...p,
    netPos: Math.max(p.cumNet, 0),
    netNeg: Math.min(p.cumNet, 0),
  }));

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="4 3" stroke="rgba(28,25,23,0.07)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtTick} tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={makeTooltip(view)} cursor={{ stroke: "rgba(28,25,23,0.2)", strokeDasharray: "4 3" }} />
          {isBreakeven && (
            <ReferenceLine x={points[breakevenIdx].label} stroke="#43884d" strokeDasharray="3 3" />
          )}
          {view === "bruto" ? (
            <>
              <Line type="monotone" dataKey="cumRevenue" stroke="#43884d" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cumExpenses" stroke="#f44854" strokeWidth={2} dot={false} />
            </>
          ) : (
            <>
              <ReferenceLine y={0} stroke="rgba(28,25,23,0.3)" />
              <Area type="monotone" dataKey="netPos" stroke="none" fill="#43884d" fillOpacity={0.12} />
              <Area type="monotone" dataKey="netNeg" stroke="none" fill="#f44854" fillOpacity={0.12} />
              <Line type="monotone" dataKey="cumNet" stroke="#1c1917" strokeWidth={2} dot={false} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
