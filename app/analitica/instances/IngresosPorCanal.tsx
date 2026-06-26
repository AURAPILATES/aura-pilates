import { fmt, pct } from "@/lib/analytics";
import { ChartCard } from "@/components/charts";

type MethodRow = { key: string; label: string; revenue: number; count: number; bar: string };

export default function IngresosPorCanal({
  rows,
  combinedTotal,
  rangeLabel,
}: {
  rows: MethodRow[];
  combinedTotal: number;
  rangeLabel?: string | null;
}) {
  return (
    <ChartCard
      title="Por canal de pago"
      subtitle="Distribución de ingresos por método de pago en el período"
      dataSource={`Stripe en vivo + Urban Sports Club (Momence CSV)${rangeLabel ? ` · datos hasta ${rangeLabel}` : ""}.`}
      sources={["stripe", "momence"]}
    >
      <div className="space-y-4">
        {rows.map((row) => {
          const share = combinedTotal > 0 ? row.revenue / combinedTotal : 0;
          return (
            <div key={row.key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-navy">{row.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-navy/55 tabular-nums">{row.count} cobros</span>
                  <span className="text-xs font-medium text-navy tabular-nums w-16 text-right">{fmt(row.revenue)}</span>
                  <span className="text-xs text-navy/55 w-8 text-right tabular-nums">{pct(share)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-navy/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${row.bar}`} style={{ width: pct(share) }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-navy/5 flex justify-between">
        <span className="text-xs text-navy/55">Total período</span>
        <span className="text-xs font-semibold text-navy">{fmt(combinedTotal)}</span>
      </div>
    </ChartCard>
  );
}
