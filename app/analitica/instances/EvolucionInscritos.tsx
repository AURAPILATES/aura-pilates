"use client";

import dynamic from "next/dynamic";
import type { ActiveCustomersRow } from "@/lib/stripePayments";
import { ChartCard } from "@/components/charts";

const EvolucionInscritosBody = dynamic(() => import("./EvolucionInscritosBody"), {
  ssr: false,
  loading: () => <div className="h-[200px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

export default function EvolucionInscritos({ data }: { data: ActiveCustomersRow[] }) {
  if (data.length === 0) {
    return <ChartCard title="Evolución de clientes activos" subtitle="Clientes con suscripción o pack vigente al cierre de cada mes." />;
  }

  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const peak = data.reduce((best, d) => (d.count > best.count ? d : best), data[0]);
  const vsPrevPct = prev && prev.count > 0 ? Math.round(((last.count - prev.count) / prev.count) * 100) : null;

  return (
    <ChartCard
      title="Evolución de clientes activos"
      subtitle="Clientes con suscripción o pack vigente al cierre de cada mes."
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
      dataSource="Suscripción (vigencia 45 días) o pack (15–90 días según tipo) según último pago en Stripe"
      sources={["stripe"]}
      lastUpdated="ahora"
    >
      <EvolucionInscritosBody data={data} />
    </ChartCard>
  );
}
