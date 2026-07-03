import type { FirstPurchaseSummary } from "@/lib/sales";
import { ChartCard } from "@/components/charts";

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

const COLORS = ["#6B7ED6", "#D4AA35", "#9260B8", "#4A7A9B", "#4A9870", "#D46055", "#C46890", "#3AA09C"];

export default function PrimeraCompra({ summary }: { summary: FirstPurchaseSummary }) {
  const { totalSubscribers, rows } = summary;

  return (
    <ChartCard
      title="¿Cómo llegan los suscriptores?"
      subtitle={`Primera compra de los ${totalSubscribers} clientes que alguna vez se suscribieron`}
      dateRange="Histórico completo"
      dataSource="Stripe, producto identificado por importe del cobro (estimación) · primera compra = la de fecha más antigua de cada cliente, sea cual sea el producto"
      sources={["stripe"]}
      lastUpdated="ahora"
    >
      {rows.length === 0 ? (
        <p className="text-sm text-navy/45 text-center py-10">Sin datos suficientes</p>
      ) : (
        <>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.item}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-navy">{r.item}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-navy/55 tabular-nums">{r.count} clientes</span>
                  <span className="text-xs font-medium text-navy w-12 text-right tabular-nums">{pct(r.rate)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-navy/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: pct(r.rate), backgroundColor: COLORS[i % COLORS.length] }} />
              </div>
            </div>
          ))}
        </div>
</>
      )}
    </ChartCard>
  );
}
