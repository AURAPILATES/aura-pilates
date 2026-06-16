"use client";
import { useState } from "react";
import { BookOpen } from "react-feather";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { MonthlySubStats } from "@/lib/subscriptionCohort";

const COLORS = ["#6B7ED6", "#9260B8", "#D4AA35", "#4A7A9B", "#4A9870", "#D46055", "#C46890", "#3AA09C", "#8878C0"];
const BAR_AREA_H = 180;

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

export default function SubscriptionEvolutionChart({
  monthly,
  cohorts,
}: {
  monthly: MonthlyProductRevenue[];
  cohorts: MonthlySubStats[];
}) {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  if (monthly.length === 0) {
    return (
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
        <p className="text-xs font-semibold text-navy/55 uppercase tracking-widest mb-4">Evolución de ingresos y suscripciones</p>
        <p className="text-sm text-navy/45 text-center py-10">Sin datos suficientes</p>
      </div>
    );
  }

  const allItems = Array.from(new Set(monthly.flatMap((m) => m.items.map((i) => i.name))));
  const colorOf = (name: string) => COLORS[allItems.indexOf(name) % COLORS.length];
  const maxTotal = Math.max(...monthly.map((m) => m.total), 1);
  const cohortByMonth = new Map(cohorts.map((c) => [c.month, c]));
  const hovered = hoveredMonth ? monthly.find((m) => m.month === hoveredMonth) : null;
  const hoveredCohort = hoveredMonth ? cohortByMonth.get(hoveredMonth) : null;

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
      <p className="text-xs font-semibold text-navy/55 uppercase tracking-widest mb-4">Evolución de ingresos y suscripciones</p>

      <div className="flex items-end gap-2" style={{ height: BAR_AREA_H + 24 }}>
        {monthly.map((m) => {
          const barH = Math.max((m.total / maxTotal) * BAR_AREA_H, m.total > 0 ? 2 : 0);
          return (
            <div
              key={m.month}
              className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer"
              onMouseEnter={() => setHoveredMonth(m.month)}
              onMouseLeave={() => setHoveredMonth(null)}
            >
              <div className="w-full flex flex-col justify-end" style={{ height: BAR_AREA_H }}>
                <div
                  className="w-full flex flex-col-reverse rounded-t-sm overflow-hidden transition-opacity"
                  style={{ height: barH, opacity: hoveredMonth && hoveredMonth !== m.month ? 0.4 : 1 }}
                >
                  {m.items.map((it) => (
                    <div
                      key={it.name}
                      style={{ height: `${(it.revenue / m.total) * 100}%`, backgroundColor: colorOf(it.name) }}
                    />
                  ))}
                </div>
              </div>
              <span className="text-[9.5px] text-navy/45 whitespace-nowrap">{m.label.replace(" ", "'").slice(0, -2)}</span>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-3 mt-3 mb-1">
        {allItems.map((name) => (
          <span key={name} className="flex items-center gap-1.5 text-xs text-navy/60">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: colorOf(name) }} />
            {name}
          </span>
        ))}
      </div>

      {/* Detalle del mes con hover, o resumen del total */}
      <div className="mt-3 pt-3 border-t border-navy/5 text-xs text-navy/55 min-h-[20px]">
        {hovered ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-navy">{hovered.label}</span>
            <span>{fmtEur(hovered.total)}</span>
            {hoveredCohort && (
              <>
                <span className="text-success">+{hoveredCohort.newSubs} altas</span>
                <span className="text-danger">−{hoveredCohort.churned} bajas</span>
                <span className="text-primary">{hoveredCohort.reactivated} reactivaciones</span>
              </>
            )}
          </div>
        ) : (
          <span>Pasa el cursor por una barra para ver el detalle del mes.</span>
        )}
      </div>

      {/* Tabla de altas / bajas / reactivaciones */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-navy/[0.06]">
              <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Mes</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Ingresos</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Suscriptores</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Altas</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Bajas</th>
              <th className="text-right py-2 text-navy/45 font-semibold uppercase tracking-wide">Reactivaciones</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => {
              const c = cohortByMonth.get(m.month);
              return (
                <tr key={m.month} className="border-b border-navy/[0.04] last:border-0">
                  <td className="py-2 pr-3 text-navy/70">{m.label}</td>
                  <td className="py-2 pr-3 text-right text-navy tabular-nums">{fmtEur(m.total)}</td>
                  <td className="py-2 pr-3 text-right text-navy tabular-nums">{c?.activeCount ?? "—"}</td>
                  <td className="py-2 pr-3 text-right text-success font-medium tabular-nums">{c ? `+${c.newSubs}` : "—"}</td>
                  <td className="py-2 pr-3 text-right text-danger font-medium tabular-nums">{c ? `−${c.churned}` : "—"}</td>
                  <td className="py-2 text-right text-primary font-medium tabular-nums">{c?.reactivated ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-navy/45 mt-3 flex items-center gap-1.5">
        <BookOpen size={12} className="shrink-0" />
        Ingresos: Stripe + catálogo Momence en vivo (Urban Sports Club desde CSV). Altas/bajas/reactivaciones: identificadas por el patrón de pagos de suscripción en Stripe.
      </p>
    </div>
  );
}
