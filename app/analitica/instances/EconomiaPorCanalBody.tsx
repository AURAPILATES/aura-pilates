"use client";

import { ResponsiveContainer, ComposedChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, type TooltipContentProps } from "recharts";
import type { ChannelEconomicsRow } from "@/lib/channelEconomics";

const COLOR_STRIPE = "var(--chart-violet-1)";
const COLOR_USC    = "var(--color-warning)";

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " €";
}

function fmtTick(v: number) {
  return `${Math.round(v)}€`;
}

function EconomiaTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ChannelEconomicsRow;
  return (
    <div className="bg-card border border-border rounded-[10px] shadow-lg px-3 py-2 text-xs min-w-[170px]">
      <p className="font-semibold text-navy mb-1.5">{row.label}</p>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: COLOR_STRIPE }} />
        <span className="text-navy/55">Stripe</span>
        <span className="font-semibold text-navy ml-auto">{row.stripePerClass !== null ? `${fmtEur(row.stripePerClass)}/clase` : "-"}</span>
      </div>
      {row.stripePerClass !== null && <p className="text-[10px] text-navy/40 pl-3.5">{row.stripeClasses} clases asistidas</p>}
      <div className="flex items-center gap-1.5 mt-1.5 mb-0.5">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: COLOR_USC }} />
        <span className="text-navy/55">Urban</span>
        <span className="font-semibold text-navy ml-auto">{row.urbanPerClass !== null ? `${fmtEur(row.urbanPerClass)}/clase` : "-"}</span>
      </div>
      {row.urbanPerClass !== null && <p className="text-[10px] text-navy/40 pl-3.5">{row.urbanClasses} clases asistidas</p>}
    </div>
  );
}

export default function EconomiaPorCanalBody({ data }: { data: ChannelEconomicsRow[] }) {
  if (data.length === 0) return <p className="text-sm text-navy/45 text-center py-10">Sin datos suficientes</p>;

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="4 3" stroke="color-mix(in srgb, var(--color-navy) 7%, transparent)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "color-mix(in srgb, var(--color-navy) 45%, transparent)" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtTick} tick={{ fontSize: 10, fill: "color-mix(in srgb, var(--color-navy) 45%, transparent)" }} tickLine={false} axisLine={false} width={36} />
          <Tooltip content={EconomiaTooltip} cursor={{ fill: "color-mix(in srgb, var(--color-navy) 4%, transparent)" }} />
          <Bar dataKey="stripePerClass" name="Stripe" fill={COLOR_STRIPE} radius={[2, 2, 0, 0]} />
          <Bar dataKey="urbanPerClass" name="Urban" fill={COLOR_USC} radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
