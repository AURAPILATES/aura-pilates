"use client";

import dynamic from "next/dynamic";
import type { StripePayment } from "@/lib/stripePayments";
import { ChartCard } from "@/components/charts";
import type { InscritosRow } from "./EvolucionInscritosBody";

const EvolucionInscritosBody = dynamic(() => import("./EvolucionInscritosBody"), {
  ssr: false,
  loading: () => <div className="h-[200px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function uniqueActiveCustomersByMonth(payments: StripePayment[]): InscritosRow[] {
  const byMonth = new Map<string, Set<string>>();
  for (const p of payments) {
    const id = p.customerId ?? p.customerEmail;
    if (!id) continue;
    const m = p.date.slice(0, 7);
    const set = byMonth.get(m) ?? new Set<string>();
    set.add(id);
    byMonth.set(m, set);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, ids]) => ({ month, label: monthLabel(month), count: ids.size }));
}

export default function EvolucionInscritos({ payments }: { payments: StripePayment[] }) {
  const data = uniqueActiveCustomersByMonth(payments);

  if (data.length === 0) {
    return <ChartCard title="Evolución de inscritos" subtitle="Sin datos suficientes" />;
  }

  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const peak = data.reduce((best, d) => (d.count > best.count ? d : best), data[0]);
  const vsPrevPct = prev && prev.count > 0 ? Math.round(((last.count - prev.count) / prev.count) * 100) : null;

  return (
    <ChartCard
      title="Evolución de inscritos"
      subtitle="Clientes únicos con al menos un pago por mes"
      dateRange="Desde apertura"
      kpiItems={[
        { label: `Activos ${last.label.split(" ")[0].toLowerCase()}`, value: String(last.count), valueClassName: "text-primary" },
        {
          label: "Pico histórico",
          value: <>{peak.count} <span className="text-xs text-navy/50 font-normal">{peak.label.split(" ")[0].toLowerCase()}</span></>,
        },
        {
          label: "Vs mes ant.",
          value: vsPrevPct !== null ? `${vsPrevPct >= 0 ? "+" : ""}${vsPrevPct}%` : "—",
          valueClassName: vsPrevPct === null ? "text-navy/50" : vsPrevPct >= 0 ? "text-success" : "text-danger",
        },
      ]}
      dataSource="Clientes únicos con cobro registrado en Stripe por mes"
      sources={["stripe"]}
    >
      <EvolucionInscritosBody data={data} />
    </ChartCard>
  );
}
