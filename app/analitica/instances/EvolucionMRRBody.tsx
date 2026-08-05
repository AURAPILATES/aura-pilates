"use client";

import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, type TooltipContentProps } from "recharts";
import type { MrrHistoryPoint } from "@/lib/subscriptionsV2";

const COLOR = "var(--chart-violet-1)";

function fmtEur(v: number) {
  return Math.round(v).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

function fmtTick(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function MrrTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as MrrHistoryPoint;
  return (
    <div className="bg-card border border-border rounded-[10px] shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-navy mb-1">{fmtDate(row.date)}</p>
      <p className="text-navy/55">MRR <span className="font-semibold text-navy ml-1">{fmtEur(row.totalMrr)}</span></p>
      <p className="text-navy/55">{row.totalSubscriptions} suscripciones activas</p>
    </div>
  );
}

export default function EvolucionMRRBody({ data }: { data: MrrHistoryPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-navy/45 text-center py-10">Sin snapshot de suscripciones v2 todavía</p>;
  }

  const rows = data.map((d) => ({ ...d, label: fmtDate(d.date) }));

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="mrr-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR} stopOpacity={0.22} />
              <stop offset="100%" stopColor={COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 3" stroke="color-mix(in srgb, var(--color-navy) 7%, transparent)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "color-mix(in srgb, var(--color-navy) 45%, transparent)" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtTick} tick={{ fontSize: 10, fill: "color-mix(in srgb, var(--color-navy) 45%, transparent)" }} tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} />
          <Tooltip content={MrrTooltip} cursor={{ stroke: "color-mix(in srgb, var(--color-navy) 20%, transparent)", strokeDasharray: "4 3" }} />
          <Area type="monotone" dataKey="totalMrr" stroke={COLOR} strokeWidth={2} fill="url(#mrr-grad)" dot={{ r: 3, fill: COLOR, stroke: "white", strokeWidth: 1.5 }} activeDot={{ r: 4.5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
