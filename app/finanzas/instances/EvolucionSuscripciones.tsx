"use client";

import dynamic from "next/dynamic";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { MonthlySubStats } from "@/lib/subscriptionCohort";
import { ChartCard } from "@/components/charts";

const EvolucionSuscripcionesBody = dynamic(() => import("./EvolucionSuscripcionesBody"), {
  ssr: false,
  loading: () => <div className="h-[200px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

export default function EvolucionSuscripciones({
  monthly,
  cohorts,
}: {
  monthly: MonthlyProductRevenue[];
  cohorts: MonthlySubStats[];
}) {
  if (monthly.length === 0) {
    return (
      <ChartCard title="Evolución de ingresos y suscripciones" subtitle="Sin datos suficientes" />
    );
  }

  const bestMonth = monthly.reduce((best, m) => (m.total > best.total ? m : best), monthly[0]);
  const last2 = cohorts.slice(-2);
  const altasLast2 = last2.reduce((s, c) => s + c.newSubs, 0);
  const bajasLast2 = last2.reduce((s, c) => s + c.churned, 0);
  const last2Label = last2.map((c) => c.label.split(" ")[0].toLowerCase()).join("–");

  return (
    <ChartCard
      title="Evolución de ingresos y suscripciones"
      subtitle="Ingresos mensuales desglosados por producto · altas, bajas y reactivaciones"
      kpiItems={[
        {
          label: "Mejor mes",
          value: <>{fmtEur(bestMonth.total)} <span className="text-xs text-navy/50 font-normal">{bestMonth.label.split(" ")[0].toLowerCase()}</span></>,
        },
        { label: `Altas ${last2Label}`, value: `+${altasLast2}`, valueClassName: "text-success" },
        { label: `Bajas ${last2Label}`, value: `−${bajasLast2}`, valueClassName: "text-danger" },
      ]}
      dataSource="Ingresos: Stripe + catálogo Momence en vivo (Urban Sports Club desde CSV) · Altas/bajas/reactivaciones identificadas por el patrón de pagos de suscripción en Stripe"
    >
      <EvolucionSuscripcionesBody monthly={monthly} cohorts={cohorts} />
    </ChartCard>
  );
}
