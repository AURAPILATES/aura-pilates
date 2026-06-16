import { BookOpen } from "react-feather";
import type { TierMrr } from "@/lib/mrr";

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

const TIER_COLORS: Record<string, string> = {
  "Bàsic": "#4A7A9B",
  "Plus": "#6B7ED6",
  "Pro": "#9260B8",
};

export default function MrrCard({ tiers }: { tiers: TierMrr[] }) {
  const totalMrr = tiers.reduce((s, t) => s + t.mrr, 0);
  const totalArr = tiers.reduce((s, t) => s + t.arr, 0);
  const totalActive = tiers.reduce((s, t) => s + t.activeCount, 0);

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
      <p className="text-xs font-semibold text-navy/55 uppercase tracking-widest mb-4">MRR / ARR por suscripción</p>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <p className="text-xs text-navy/45 uppercase tracking-wide mb-1">MRR total</p>
          <p className="text-2xl font-semibold text-navy">{fmtEur(totalMrr)}</p>
        </div>
        <div>
          <p className="text-xs text-navy/45 uppercase tracking-wide mb-1">ARR proyectado</p>
          <p className="text-2xl font-semibold text-navy">{fmtEur(totalArr)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {tiers.map((t) => {
          const share = totalMrr > 0 ? t.mrr / totalMrr : 0;
          const color = TIER_COLORS[t.name] ?? "#6B7280";
          return (
            <div key={t.name}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="flex items-center gap-2 text-sm text-navy font-medium">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  {t.name}
                  <span className="text-xs text-navy/40">({fmtEur(t.price)}/mes · {t.activeCount} clientes)</span>
                </span>
                <span className="text-sm font-semibold text-navy tabular-nums">{fmtEur(t.mrr)}</span>
              </div>
              <div className="h-1.5 bg-navy/[0.05] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-navy/5 flex justify-between">
        <span className="text-xs text-navy/55">Clientes recurrentes totales</span>
        <span className="text-xs font-semibold text-navy">{totalActive}</span>
      </div>

      <p className="text-xs text-navy/45 mt-3 flex items-center gap-1.5">
        <BookOpen size={12} className="shrink-0" />
        MRR = suscriptores activos (no congelados) × precio del tier, según Momence en vivo.
      </p>
    </div>
  );
}
