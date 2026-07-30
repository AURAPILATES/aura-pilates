import ChartCard from "@/components/charts/ChartCard";
import type { AtRiskV2, AtRiskReason } from "@/lib/atRiskV2";

const BADGE: Record<AtRiskReason, string> = {
  "Congelada": "bg-navy/[0.06] text-navy/70",
  "Sin créditos": "bg-danger/10 text-danger",
  "Pocos créditos": "bg-warning/10 text-warning",
  "Caduca pronto": "bg-warning/10 text-warning",
};

// Lista accionable de retención: quién necesita atención ahora (packs por
// agotarse/agotados, por caducar, congeladas), desde el snapshot v2.
export default function NecesitaAtencion({ data }: { data: AtRiskV2 }) {
  if (!data.date) {
    return <ChartCard title="Necesita atención" subtitle="Aún no hay snapshot de suscripciones v2" />;
  }
  if (data.items.length === 0) {
    return (
      <ChartCard
        title="Necesita atención"
        subtitle="Nadie en riesgo ahora mismo 🎉"
        dataSource="Snapshot diario de Momence (API v2) · packs por agotarse/caducar y suscripciones congeladas"
        sources={["momence"]}
        lastUpdated={`snapshot ${data.date}`}
      />
    );
  }

  return (
    <ChartCard
      title="Necesita atención"
      subtitle="Packs por agotarse o caducar y suscripciones congeladas — momento de contactar"
      kpiItems={[
        {
          label: "En riesgo",
          value: String(data.items.length),
          valueClassName: "text-warning",
          tooltip: "Total de clientes que necesitan atención ahora: packs por agotarse o agotados, packs por caducar y suscripciones congeladas. Excluye clases sueltas (compra única).",
        },
        {
          label: "Sin créditos",
          value: String(data.counts["Sin créditos"]),
          tooltip: "Packs multi-clase con 0 clases restantes: han gastado todo el bono. Momento ideal para proponer renovación o pasar a suscripción.",
        },
        {
          label: "Caduca pronto",
          value: String(data.counts["Caduca pronto"]),
          tooltip: "Packs que caducan en ≤14 días con clases aún sin usar: conviene avisar antes de que se pierdan.",
        },
      ]}
      dataSource="Snapshot diario de Momence (API v2) · packs multi-clase con ≤2 créditos o que caducan en ≤14 días, y suscripciones congeladas. Excluye clases sueltas (one-off)."
      sources={["momence"]}
      lastUpdated={`snapshot ${data.date}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-navy/[0.07] text-navy/50 text-xs">
              <th className="text-left font-medium py-2 pr-3">Cliente</th>
              <th className="text-left font-medium py-2 pr-3">Plan</th>
              <th className="text-left font-medium py-2 pr-3">Motivo</th>
              <th className="text-left font-medium py-2">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, i) => (
              <tr key={`${it.email}-${i}`} className="border-b border-navy/[0.04]">
                <td className="py-2 pr-3 text-navy">{it.email}</td>
                <td className="py-2 pr-3 text-navy/70">{it.membershipName}</td>
                <td className="py-2 pr-3">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${BADGE[it.reason]}`}>
                    {it.reason}
                  </span>
                </td>
                <td className="py-2 text-navy/60 tabular-nums">{it.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
