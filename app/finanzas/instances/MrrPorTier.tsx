import { fmt } from "@/lib/analytics";
import type { TierMrr } from "@/lib/mrr";
import { ChartCard } from "@/components/charts";

const TIER_COLORS: Record<string, string> = {
  "Bàsic": "#4A7A9B",
  "Plus": "#6B7ED6",
  "Pro": "#9260B8",
};

export default function MrrPorTier({ tiers }: { tiers: TierMrr[] }) {
  const totalMrr = tiers.reduce((s, t) => s + t.mrr, 0);
  const totalArr = tiers.reduce((s, t) => s + t.arr, 0);
  const totalActive = tiers.reduce((s, t) => s + t.activeCount, 0);

  return (
    <ChartCard
      title="MRR / ARR por suscripción"
      subtitle="Ingresos recurrentes mensuales y proyección anual por tier"
      kpiItems={[
        { label: "MRR total", value: fmt(totalMrr) },
        { label: "ARR proyectado", value: fmt(totalArr) },
        { label: "Suscriptores activos", value: String(totalActive) },
      ]}
      dataSource="MRR = suscriptores activos (no congelados) × precio del tier · Momence en vivo"
      sources={["momence"]}
    >
      <div className="flex flex-col gap-3.5">
        {tiers.map((t) => {
          const share = totalMrr > 0 ? t.mrr / totalMrr : 0;
          const color = TIER_COLORS[t.name] ?? "#6B7280";
          const isEmpty = t.activeCount === 0;
          return (
            <div key={t.name}>
              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className={`text-sm font-medium ${isEmpty ? "text-navy/50" : "text-navy"}`}>{t.name}</span>
                  <span className="text-[11px] text-navy/45 whitespace-nowrap">
                    {fmt(t.price)}/mes · {t.activeCount} clientes
                  </span>
                </span>
                <span className={`text-sm font-medium shrink-0 ${isEmpty ? "text-navy/50" : "text-navy"}`}>
                  {fmt(t.mrr)}
                </span>
              </div>
              <div className="h-1.5 bg-navy/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3.5 pt-3 border-t border-navy/[0.07] flex justify-between text-xs">
        <span className="text-navy/55">Clientes recurrentes totales</span>
        <span className="font-medium text-navy">{totalActive}</span>
      </div>
    </ChartCard>
  );
}
