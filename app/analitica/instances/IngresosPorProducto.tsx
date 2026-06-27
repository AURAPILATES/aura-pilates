import { fmt, pct } from "@/lib/analytics";
import { ChartCard } from "@/components/charts";

type ProductRow = { item: string; revenue: number; count: number; share: number; color: string };

export default function IngresosPorProducto({
  segments,
  total,
}: {
  segments: ProductRow[];
  total: number;
}) {
  const maxRevenue = Math.max(...segments.map((s) => s.revenue), 0);

  return (
    <ChartCard
      title="Ingresos por producto"
      subtitle="Distribución de ingresos por producto o tarifa en el período"
      dataSource="Stripe + catálogo Momence en vivo"
      sources={["stripe", "momence"]}
    >
      {segments.length === 0 ? (
        <p className="text-sm text-navy/45 text-center py-10">Sin datos de productos.</p>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-5">
            <p className="text-xs text-navy/45 font-medium">Ingresos totales</p>
            <p className="text-2xl font-bold text-navy tabular-nums leading-tight">{fmt(total)}</p>
          </div>

          <div className="space-y-3">
            {segments.map((seg) => (
              <div key={seg.item}>
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-navy truncate">{seg.item}</p>
                    <p className="text-xs text-navy/50">{seg.count} ventas</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold text-navy tabular-nums">{fmt(seg.revenue)}</p>
                    <p className="text-xs text-navy/50 tabular-nums">{pct(seg.share)}</p>
                  </div>
                </div>
                <div className="h-2 bg-navy/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max((maxRevenue > 0 ? seg.revenue / maxRevenue : 0) * 100, 2)}%`, backgroundColor: seg.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}
