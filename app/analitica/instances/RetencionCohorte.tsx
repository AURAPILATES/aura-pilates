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
        { label: "Retención M+1 media", value: m1Avg !== null ? `${m1Avg}%` : "—", valueClassName: "text-primary" },
        {
          label: "Mejor cohorte M+1",
          value: best ? <>{best.values[0]}% <span className="text-xs text-navy/50 font-normal">{best.label.split(" ")[0].toLowerCase()}</span></> : "—",
          valueClassName: "text-success",
        },
        { label: "Cohortes activas", value: String(cohorts.length) },
      ]}
      dataSource="Cohorte = mes del primer pago de suscripción · pagos Stripe en vivo"
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
