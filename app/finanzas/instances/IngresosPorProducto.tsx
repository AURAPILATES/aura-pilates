import { fmt, pct } from "@/lib/analytics";
import { ChartCard } from "@/components/charts";

type ProductRow = { item: string; revenue: number; count: number; share: number; color: string };

const R = 80;
const CX = 100;
const CY = 100;
const CIRC = 2 * Math.PI * R;
const SW = 20;

export default function IngresosPorProducto({
  segments,
  total,
  rangeLabel,
}: {
  segments: ProductRow[];
  total: number;
  rangeLabel?: string | null;
}) {
  let acc = 0;
  const donutSegments = segments.map((s) => {
    const dash = s.share * CIRC;
    const gap = 2;
    const offset = -(acc + (segments.length > 1 ? gap / 2 : 0));
    acc += dash + gap;
    return { ...s, dash: Math.max(dash - gap, 0), offset };
  });

  return (
    <ChartCard
      title="Ingresos por producto"
      subtitle="Distribución de ingresos por producto o tarifa en el período"
      dateRange={rangeLabel ?? undefined}
      dataSource="Stripe + catálogo Momence en vivo · Urban Sports Club desde CSV"
      sources={["stripe", "momence"]}
    >
      {segments.length === 0 ? (
        <p className="text-sm text-navy/45 text-center py-10">Sin datos de productos.</p>
      ) : (
        <>
          <div className="flex justify-center mb-6">
            <div className="relative w-[180px] h-[180px]">
              <svg viewBox="0 0 200 200" width="180" height="180">
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(28,25,23,0.05)" strokeWidth={SW} />
                <g transform={`rotate(-90, ${CX}, ${CY})`}>
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.item}
                      cx={CX} cy={CY} r={R}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={SW}
                      strokeDasharray={`${seg.dash} ${CIRC}`}
                      strokeDashoffset={seg.offset}
                      strokeLinecap="round"
                    />
                  ))}
                </g>
                <foreignObject x="20" y="70" width="160" height="70">
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <p className="text-[11px] text-navy/45 font-medium mb-1">Ingresos</p>
                    <p className="text-lg font-semibold text-navy tabular-nums leading-tight">{fmt(total)}</p>
                  </div>
                </foreignObject>
              </svg>
            </div>
          </div>

          <div className="divide-y divide-navy/[0.05]">
            {segments.map((seg) => (
              <div key={seg.item} className="flex items-center gap-2.5 py-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-navy truncate">{seg.item}</p>
                  <p className="text-xs text-navy/50">{seg.count} ventas</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-medium text-navy tabular-nums">{fmt(seg.revenue)}</p>
                  <p className="text-xs text-navy/50 tabular-nums">{pct(seg.share)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </ChartCard>
  );
}
