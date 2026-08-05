"use client";

import dynamic from "next/dynamic";
import { ChartCard, StaticLegend } from "@/components/charts";
import type { ChannelEconomicsRow } from "@/lib/channelEconomics";

const EconomiaPorCanalBody = dynamic(() => import("./EconomiaPorCanalBody"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " €";
}

// € por clase asistida, por canal: Stripe (interno) vs Urban Sports Club, para comparar el
// ingreso real por clase de cada uno, no solo el volumen total. Ver [[project-momence-sales-migration]].
export default function EconomiaPorCanal({ data }: { data: ChannelEconomicsRow[] }) {
  if (data.length === 0) {
    return <ChartCard title="Economía por canal" subtitle="€ por clase asistida, Stripe vs Urban Sports Club" />;
  }

  const totalStripeRevenue = data.reduce((s, r) => s + r.stripeRevenue, 0);
  const totalStripeClasses = data.reduce((s, r) => s + r.stripeClasses, 0);
  const totalUrbanRevenue = data.reduce((s, r) => s + r.urbanRevenue, 0);
  const totalUrbanClasses = data.reduce((s, r) => s + r.urbanClasses, 0);
  const stripeAvg = totalStripeClasses > 0 ? totalStripeRevenue / totalStripeClasses : null;
  const urbanAvg = totalUrbanClasses > 0 ? totalUrbanRevenue / totalUrbanClasses : null;

  return (
    <ChartCard
      title="Economía por canal"
      subtitle="€ por clase realmente asistida, Stripe (interno) vs Urban Sports Club"
      kpiItems={[
        {
          label: "€/clase Stripe",
          value: stripeAvg !== null ? fmtEur(stripeAvg) : "-",
          valueClassName: "text-primary",
          helper: `${totalStripeClasses} clases`,
          tooltip: "Ingresos brutos de Stripe (suscripciones + packs) del período ÷ clases realmente asistidas por miembros que no son de Urban Sports Club.",
        },
        {
          label: "€/clase Urban",
          value: urbanAvg !== null ? fmtEur(urbanAvg) : "-",
          valueClassName: "text-warning",
          helper: `${totalUrbanClasses} clases`,
          tooltip: "€ de Urban Sports Club asignado a cada mes (real si ya se facturó, estimado si no) ÷ clases asistidas por miembros de Urban ese mes.",
        },
      ]}
      dataSource="€ Stripe = ingreso bruto de Stripe (suscripciones y packs) ÷ clases asistidas (checkedIn, Momence API v2) por miembros no-Urban ese mes. € Urban = importe asignado al mes (real o estimado, ver Ventas por Fuente) ÷ clases asistidas por miembros de Urban. No compara el mismo tipo de compromiso (suscripción/pack de permanencia vs Urban por uso puntual), pero sí el ingreso real por clase de cada canal."
      sources={["stripe", "momence"]}
    >
      <StaticLegend
        className="mb-3"
        items={[
          { label: "Stripe (interno)", color: "var(--chart-violet-1)", swatch: "dot" },
          { label: "Urban Sports Club", color: "var(--color-warning)", swatch: "dot" },
        ]}
      />
      <EconomiaPorCanalBody data={data} />
    </ChartCard>
  );
}
