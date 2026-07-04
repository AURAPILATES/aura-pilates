"use client";

import {
  ResponsiveContainer, ComposedChart, Bar, Line, CartesianGrid,
  XAxis, YAxis, Tooltip, type TooltipContentProps,
} from "recharts";

export type IngresosPorFuenteRow = {
  month: string;
  label: string;
  stripeGross: number;
  stripeFees: number;
  stripeNet: number;
  uscNet: number;
};

const COLOR_STRIPE = "#4021c8"; // primary
const COLOR_USC    = "#F59E0B"; // warning

function fmtEur(v: number) {
  return Math.round(v).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

function fmtTick(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;
}

function FuenteTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as IngresosPorFuenteRow;
  return (
    <div className="bg-white border border-navy/[0.07] rounded-lg shadow-card px-3 py-2 text-xs min-w-[160px]">
      <p className="font-semibold text-navy mb-1.5">{row.label}</p>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: COLOR_STRIPE }} />
        <span className="text-navy/55">Stripe</span>
        <span className="font-semibold text-navy ml-auto">{fmtEur(row.stripeGross)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: COLOR_USC }} />
        <span className="text-navy/55">Urban</span>
        <span className="font-semibold text-navy ml-auto">{fmtEur(row.uscNet)}</span>
      </div>
    </div>
  );
}

export default function IngresosPorFuenteBody({
  data,
  chartType,
}: {
  data: IngresosPorFuenteRow[];
  chartType: "bar" | "line";
}) {
  if (data.length === 0) return <p className="text-sm text-navy/45 text-center py-10">Sin datos</p>;

  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="4 3" stroke="rgba(28,25,23,0.07)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtTick} tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} width={34} />
          <Tooltip content={FuenteTooltip} cursor={chartType === "bar" ? { fill: "rgba(28,25,23,0.04)" } : { stroke: "rgba(28,25,23,0.2)", strokeDasharray: "4 3" }} />
          {chartType === "bar" ? (
            <>
              <Bar dataKey="stripeGross" name="Stripe" stackId="a" fill={COLOR_STRIPE} radius={[0, 0, 0, 0]} />
              <Bar dataKey="uscNet"      name="Urban"  stackId="a" fill={COLOR_USC}    radius={[2, 2, 0, 0]} />
            </>
          ) : (
            <>
              <Line type="monotone" dataKey="stripeGross" name="Stripe" stroke={COLOR_STRIPE} strokeWidth={2} dot={{ r: 3, fill: COLOR_STRIPE, stroke: "white", strokeWidth: 1.5 }} activeDot={{ r: 4.5 }} />
              <Line type="monotone" dataKey="uscNet"      name="Urban"  stroke={COLOR_USC}    strokeWidth={2} dot={{ r: 3, fill: COLOR_USC,    stroke: "white", strokeWidth: 1.5 }} activeDot={{ r: 4.5 }} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
