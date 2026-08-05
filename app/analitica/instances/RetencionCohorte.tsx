import type { RetentionCohortRow } from "@/lib/subscriptionCohort";
import { ChartCard, CohortTable } from "@/components/charts";

export default function RetencionCohorte({ cohorts }: { cohorts: RetentionCohortRow[] }) {
  if (cohorts.length === 0) {
    return <ChartCard title="Retención por cohorte" subtitle="Sin datos suficientes" />;
  }

  const m1Values = cohorts.map((c) => c.values[0]).filter((v): v is number => v !== null);
  const m1Avg = m1Values.length > 0 ? Math.round(m1Values.reduce((s, v) => s + v, 0) / m1Values.length) : null;
  const bestIdx = m1Values.length > 0 ? cohorts.findIndex((c) => c.values[0] === Math.max(...m1Values)) : -1;
  const best = bestIdx >= 0 ? cohorts[bestIdx] : null;

  return (
    <ChartCard
      title="Retención por cohorte"
      subtitle="% del grupo inicial que volvió a pagar cada mes siguiente"
      dateRange={`${cohorts[0].label} – ${cohorts[cohorts.length - 1].label}`}
      kpiItems={[
        {
          label: "Retención M+1 media",
          value: m1Avg !== null ? `${m1Avg}%` : "-",
          valueClassName: "text-primary",
          tooltip: "De cada cohorte (mes de primer pago), qué % volvió a pagar al mes siguiente. No hace falta llegar al 100%: algunas bajas al primer mes son normales (packs que no eran para renovar, prueba puntual) - lo relevante es la tendencia entre cohortes, no el valor absoluto de una sola.",
        },
        {
          label: "Mejor cohorte M+1",
          value: best ? <>{best.values[0]}% <span className="text-xs text-navy/50 font-normal">{best.label.split(" ")[0].toLowerCase()}</span></> : "-",
          valueClassName: "text-success",
          tooltip: "La cohorte de entrada con mayor % de retención al mes siguiente.",
        },
        { label: "Cohortes activas", value: String(cohorts.length), tooltip: "Meses de entrada con al menos una cohorte formada, dentro del rango mostrado." },
      ]}
      dataSource="Cohorte = mes del primer pago de suscripción en Stripe (clientes internos - no incluye Urban Sports Club, que no paga por Stripe). 'Volvió a pagar' = tuvo otro pago de suscripción en Stripe en ese mes siguiente, siga o no siendo la misma suscripción."
      sources={["stripe"]}
      lastUpdated="ahora"
    >
      <CohortTable
        columns={["M+1", "M+2", "M+3", "M+4"]}
        rows={cohorts.map((c) => ({ label: c.label, n: c.n, values: c.values }))}
      />
    </ChartCard>
  );
}
