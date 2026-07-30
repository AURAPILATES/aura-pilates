import ChartCard from "@/components/charts/ChartCard";
import type { SubscriberFirstClassV2, FirstClassBucket } from "@/lib/subscriberFirstClassV2";

const pct = (v: number) => `${Math.round(v * 100)}%`;

const DATA_SOURCE =
  "De quien alguna vez se suscribió (identificado por Stripe), su PRIMERA clase asistida (checkedIn, " +
  "Momence v2): con qué profesora y en qué franja horaria entró. Cruce por email; métrica de por vida, " +
  "no del período. Responde 'qué clase engancha a los que se suscriben', complementa el gráfico de primera compra.";

function BarList({ items, accent }: { items: FirstClassBucket[]; accent: string }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2.5">
          <span className="w-28 shrink-0 text-xs text-navy/70 truncate" title={it.label}>{it.label}</span>
          <div className="flex-1 h-4 rounded bg-navy/[0.05] overflow-hidden">
            <div className={`h-full rounded ${accent}`} style={{ width: `${(it.count / max) * 100}%` }} />
          </div>
          <span className="w-14 shrink-0 text-right text-xs tabular-nums text-navy">
            {it.count} <span className="text-navy/40">· {pct(it.rate)}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// "La primera clase de los suscriptores": por profesora y por franja horaria. Embudo de
// experiencia (con qué clase entran los que acaban suscritos), complementario al de producto.
export default function PrimeraClaseSuscriptores({ data }: { data: SubscriberFirstClassV2 | null }) {
  if (!data || !data.hasData) {
    return (
      <ChartCard
        title="Primera clase de los suscriptores"
        subtitle="Con qué profesora y en qué franja horaria entraron los que acabaron suscritos"
        dataSource={DATA_SOURCE}
        sources={["momence", "stripe"]}
      >
        <p className="text-sm text-navy/45">
          Aún no hay asistencia capturada. Aplica la migración 027 y ejecuta el backfill
          (scripts/backfill-attendance-v2.mjs) para calcular la primera clase de los suscriptores.
        </p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Primera clase de los suscriptores"
      subtitle="Con qué profesora y en qué franja horaria entraron los que acabaron suscritos. Métrica de por vida."
      dataSource={DATA_SOURCE}
      sources={["momence", "stripe"]}
      kpiItems={[
        {
          label: "Suscriptores",
          value: String(data.totalSubscribers),
          helper: "con 1ª clase registrada",
          tooltip: `Personas que alguna vez se suscribieron (Stripe) y cuya primera clase asistida consta en Momence. Cruce por email al ${pct(data.matchedRate)}.`,
        },
      ]}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h4 className="text-xs font-medium text-navy/50 mb-3">Por profesora</h4>
          <BarList items={data.byTeacher} accent="bg-primary" />
        </div>
        <div>
          <h4 className="text-xs font-medium text-navy/50 mb-3">Por franja horaria</h4>
          <BarList items={data.byHour} accent="bg-success" />
        </div>
      </div>
    </ChartCard>
  );
}
