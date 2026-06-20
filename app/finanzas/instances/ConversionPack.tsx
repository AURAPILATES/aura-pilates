"use client";

import dynamic from "next/dynamic";
import type { ConversionSummary } from "@/lib/sales";
import { ChartCard } from "@/components/charts";

const ConversionPackBody = dynamic(() => import("./ConversionPackBody"), {
  ssr: false,
  loading: () => <div className="h-[200px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export default function ConversionPack({ summary }: { summary: ConversionSummary }) {
  const { totalBuyers, totalConverted, rate, avgDaysToConvert, medianDaysToConvert } = summary;

  return (
    <ChartCard
      title="Conversión Pack Benvinguda 2×1 → suscripción"
      subtitle="% de compradores del pack que acabaron suscribiéndose"
      kpiItems={[
        { label: "Tasa de conversión", value: fmtPct(rate), valueClassName: "text-success" },
        { label: "Convertidos / total", value: <>{totalConverted} <span className="text-[13px] text-navy/50 font-normal">de {totalBuyers}</span></> },
        {
          label: "Días hasta conv. (media)",
          value: avgDaysToConvert !== null ? Math.round(avgDaysToConvert) : "—",
          helper: medianDaysToConvert !== null ? `med. ${medianDaysToConvert}d` : undefined,
        },
      ]}
      chartDescription={`Evolución mensual de la tasa de conversión del Pack Benvinguda, ${fmtPct(rate)} de media`}
      dataSource="Cohorte = mes de compra del pack · Convertido = suscripción en fecha posterior · Momence + Stripe. Haz clic en un punto o una fila para ver el detalle."
      sources={["momence", "stripe"]}
    >
      <ConversionPackBody summary={summary} />
    </ChartCard>
  );
}
