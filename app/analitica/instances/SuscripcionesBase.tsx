import ChartCard from "@/components/charts/ChartCard";
import type { SubscriptionsBaseV2 } from "@/lib/subscriptionsV2";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

// Base real de suscripción (desde el snapshot v2 de Momence): suscripciones
// activas por plan y su MRR/ARR. Antes esto no estaba visible en ningún sitio.
export default function SuscripcionesBase({ data }: { data: SubscriptionsBaseV2 }) {
  if (!data.date || data.tiers.length === 0) {
    return (
      <ChartCard title="Base de suscripción" subtitle="Aún no hay snapshot de suscripciones v2" />
    );
  }

  return (
    <ChartCard
      title="Base de suscripción"
      subtitle="Suscripciones activas por plan y su MRR / ARR"
      kpiItems={[
        {
          label: "Suscripciones activas",
          value: String(data.totalSubscriptions),
          helper: `${data.totalMembers} personas`,
        },
        { label: "MRR", value: fmtEur(data.totalMrr), valueClassName: "text-primary" },
        { label: "ARR", value: fmtEur(data.totalArr) },
      ]}
      dataSource="Snapshot diario de Momence (API v2) · suscripciones activas no congeladas, contadas por suscripción igual que el panel de Momence"
      sources={["momence"]}
      lastUpdated={`snapshot ${data.date}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-navy/[0.07] text-navy/50 text-xs">
              <th className="text-left font-medium py-2 pr-3">Plan</th>
              <th className="text-right font-medium py-2 pr-3">Activas</th>
              <th className="text-right font-medium py-2 pr-3">Precio</th>
              <th className="text-right font-medium py-2 pr-3">MRR</th>
              <th className="text-right font-medium py-2">ARR</th>
            </tr>
          </thead>
          <tbody>
            {data.tiers.map((t) => (
              <tr key={t.name} className="border-b border-navy/[0.04]">
                <td className="py-2 pr-3 text-navy">{t.name}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{t.activeCount}</td>
                <td className="py-2 pr-3 text-right text-navy/55 tabular-nums">
                  {t.price > 0 ? fmtEur(t.price) : "—"}
                </td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{fmtEur(t.mrr)}</td>
                <td className="py-2 text-right text-navy/55 tabular-nums">{fmtEur(t.arr)}</td>
              </tr>
            ))}
            <tr className="font-semibold text-navy">
              <td className="py-2 pr-3">Total</td>
              <td className="py-2 pr-3 text-right tabular-nums">{data.totalSubscriptions}</td>
              <td className="py-2 pr-3" />
              <td className="py-2 pr-3 text-right tabular-nums text-primary">{fmtEur(data.totalMrr)}</td>
              <td className="py-2 text-right tabular-nums">{fmtEur(data.totalArr)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
