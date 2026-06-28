import { fmt, pct } from "@/lib/analytics";
import { ChartCard, type MultiKpiItem } from "@/components/charts";

type MethodRow = { key: string; label: string; revenue: number; count: number; bar: string };

export default function IngresosPorCanal({
  rows,
  combinedTotal,
  rangeLabel,
  comparisonTotal,
  compRangeLabel,
}: {
  rows: MethodRow[];
  combinedTotal: number;
  rangeLabel?: string | null;
  comparisonTotal?: number;
  compRangeLabel?: string;
}) {
  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const topRow = rows.length > 0 ? rows.reduce((a, b) => (b.revenue > a.revenue ? b : a)) : null;
  const topShare = topRow && combinedTotal > 0 ? topRow.revenue / combinedTotal : 0;

  const kpiItems: MultiKpiItem[] = [
    { label: "Total período", value: fmt(combinedTotal) },
    { label: "Cobros", value: String(totalCount) },
  ];
  if (topRow) kpiItems.push({ label: "Canal principal", value: topRow.label, helper: pct(topShare) });
  if (comparisonTotal !== undefined && comparisonTotal > 0) {
    const deltaPct = Math.round(((combinedTotal - comparisonTotal) / comparisonTotal) * 100);
    kpiItems.push({
      label: "Variación",
      value: `${deltaPct > 0 ? "+" : ""}${deltaPct}%`,
      valueClassName: deltaPct >= 0 ? "text-success" : "text-danger",
      helper: compRangeLabel ? `vs ${fmt(comparisonTotal)} (${compRangeLabel})` : `vs ${fmt(comparisonTotal)}`,
    });
  }

  return (
    <ChartCard
      title="Por canal de pago"
      subtitle="Distribución de ingresos por método de pago en el período"
      kpiItems={kpiItems}
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
    </ChartCard>
  );
}
