"use client";

import dynamic from "next/dynamic";
import { ChartCard } from "@/components/charts";
import { pctDelta } from "@/components/charts/DeltaBadge";
import type { MrrHistoryPoint } from "@/lib/subscriptionsV2";

const EvolucionMRRBody = dynamic(() => import("./EvolucionMRRBody"), {
  ssr: false,
  loading: () => <div className="h-[200px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

const fmtEur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

// Evolución diaria de MRR/ARR desde el snapshot v2 de suscripciones (arrancó 30-jul-2026 - no
// hay forma de completar el histórico anterior, Momence no expone estado retroactivo de
// suscripciones). La serie es corta al principio y se va llenando sola cada día.
export default function EvolucionMRR({ data }: { data: MrrHistoryPoint[] }) {
  if (data.length === 0) {
    return <ChartCard title="Evolución de MRR / ARR" subtitle="Aún no hay snapshot de suscripciones v2" />;
  }

  const last = data[data.length - 1];
  const first = data[0];
  const delta = data.length > 1 ? pctDelta(last.totalMrr, first.totalMrr) : undefined;

  return (
    <ChartCard
      title="Evolución de MRR / ARR"
      subtitle={data.length < 14 ? "Serie corta - el snapshot diario arrancó el 30 de julio de 2026 y se va llenando cada día" : "Ingreso recurrente mensual/anual, día a día"}
      kpiItems={[
        {
          label: "MRR actual",
          value: fmtEur(last.totalMrr),
          valueClassName: "text-primary",
          delta,
          tooltip: "Ingreso Recurrente Mensual de hoy: suscripciones activas × precio del plan. La variación es frente al primer día con snapshot disponible.",
        },
        { label: "ARR actual", value: fmtEur(last.totalArr), tooltip: "MRR de hoy × 12: proyección a 12 meses si la base de suscripción se mantiene igual." },
        { label: "Suscripciones", value: String(last.totalSubscriptions), tooltip: "Suscripciones activas y no congeladas en el snapshot de hoy." },
      ]}
      dataSource="Snapshot diario de Momence (API v2), desde el 30 de julio de 2026 (fecha en la que se activó la captura - no se puede reconstruir hacia atrás, Momence solo expone el estado actual de las suscripciones, no su histórico). Los precios usados son los vigentes hoy en el catálogo de Momence para todas las fechas de la serie."
      sources={["momence"]}
      lastUpdated={`snapshot ${last.date}`}
    >
      <EvolucionMRRBody data={data} />
    </ChartCard>
  );
}
