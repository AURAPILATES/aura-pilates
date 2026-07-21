"use client";

import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LabelList, type TooltipContentProps } from "recharts";
import type { ActiveCustomersRow } from "@/lib/stripePayments";

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ActiveCustomersRow;
  return (
    <div className="bg-card border border-border rounded-[10px] shadow-lg px-3 py-2 text-xs max-w-[220px]">
      <p className="font-semibold text-navy mb-1">{row.label}</p>
      <p className="text-navy/70">Suscripciones: {row.subscriptions}</p>
      <p className="text-navy/70">Packs: {row.packs}</p>
      <p className="text-navy font-medium mt-1">{row.count} clientes activos</p>
      <p className="text-navy/45 mt-2 leading-snug">
        Cliente con pago vigente al cierre de mes: suscripción (Bàsic/Plus/Pro) en los últimos 31 días,
        o pack en su ventana de validez (Benvinguda 15d, clase suelta 30d, packs de clases 90d).
        Con suscripción y pack a la vez, cuenta como suscripción.
      </p>
    </div>
  );
}

export default function EvolucionInscritosBody({ data }: { data: ActiveCustomersRow[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-navy/45 text-center py-10">Sin datos suficientes</p>;
  }

  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="4 3" stroke="color-mix(in srgb, var(--color-navy) 7%, transparent)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "color-mix(in srgb, var(--color-navy) 45%, transparent)" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "color-mix(in srgb, var(--color-navy) 45%, transparent)" }} tickLine={false} axisLine={false} width={28} />
          <Tooltip content={ChartTooltip} cursor={{ fill: "color-mix(in srgb, var(--color-navy) 4%, transparent)" }} />
          <Bar dataKey="subscriptions" stackId="active" fill="var(--chart-violet-1)" />
          <Bar dataKey="packs" stackId="active" fill="var(--chart-violet-2)" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 500, fill: "var(--color-navy)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
