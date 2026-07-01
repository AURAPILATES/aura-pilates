import type { FirstPurchaseSummary } from "@/lib/sales";
import { ChartCard } from "@/components/charts";

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

const COLORS = ["#6B7ED6", "#D4AA35", "#9260B8", "#4A7A9B", "#4A9870", "#D46055", "#C46890", "#3AA09C"];

const PILL_COLORS = [
  { bg: "#EEF2FF", fill: "#C7D2FE", text: "#3730A3" },
  { bg: "#FEF9C3", fill: "#FDE68A", text: "#92400E" },
  { bg: "#F0FDF4", fill: "#BBF7D0", text: "#166534" },
  { bg: "#FFF1F2", fill: "#FECDD3", text: "#9F1239" },
  { bg: "#F5F3FF", fill: "#DDD6FE", text: "#5B21B6" },
  { bg: "#FFF7ED", fill: "#FED7AA", text: "#9A3412" },
  { bg: "#ECFEFF", fill: "#A5F3FC", text: "#164E63" },
  { bg: "#F0FDF4", fill: "#BBF7D0", text: "#166534" },
];

export default function PrimeraCompra({ summary }: { summary: FirstPurchaseSummary }) {
  const { totalSubscribers, rows } = summary;

  return (
    <ChartCard
      title="¿Cómo llegan los suscriptores?"
      subtitle={`Primera compra de los ${totalSubscribers} clientes que alguna vez se suscribieron`}
      dateRange="Histórico completo"
      dataSource="Momence CSV · primera compra = la de fecha más antigua de cada cliente, sea cual sea el producto"
      sources={["momence"]}
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

        <div className="mt-6 pt-5 border-t border-navy/[0.06]">
          <p className="text-xs font-medium text-navy/55 mb-3">Vista alternativa</p>
          <div className="space-y-2.5">
            {rows.map((r, i) => {
              const c = PILL_COLORS[i % PILL_COLORS.length];
              return (
                <div
                  key={`pill-${r.item}`}
                  style={{ backgroundColor: c.bg }}
                  className="rounded-2xl flex items-center h-11 overflow-hidden"
                >
                  <div
                    className="w-44 shrink-0 px-4 h-full flex items-center"
                    style={{ borderRight: `1.5px solid ${c.fill}` }}
                  >
                    <span style={{ color: c.text }} className="text-sm font-medium truncate">{r.item}</span>
                  </div>
                  <div className="flex-1 relative h-full">
                    <div
                      style={{ width: pct(r.rate), backgroundColor: c.fill, minWidth: "3rem" }}
                      className="absolute left-0 top-0 h-full flex items-center justify-end pr-1.5"
                    >
                      <span
                        style={{ color: c.text }}
                        className="text-xs font-semibold bg-white rounded-full px-2 py-0.5 whitespace-nowrap"
                      >
                        {pct(r.rate)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}
    </ChartCard>
  );
}
