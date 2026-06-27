"use client";

import { useState } from "react";
import { fmt, pct } from "@/lib/analytics";
import { ChartCard, ProportionBar, ToggleGroup } from "@/components/charts";
import type { TierMrr } from "@/lib/mrr";

type Tab = "fuentes" | "productos" | "suscripciones";

const TABS: { key: Tab; label: string }[] = [
  { key: "fuentes", label: "Fuentes" },
  { key: "productos", label: "Productos" },
  { key: "suscripciones", label: "Suscripciones" },
];

type ProductRow = { item: string; revenue: number; count: number; share: number; color: string };

const TIER_COLORS: Record<string, string> = {
  "Bàsic": "#4A7A9B",
  "Plus": "#6B7ED6",
  "Pro": "#9260B8",
};

export default function Ingresos({
  recurrente,
  puntual,
  totalRev,
  stripeFees,
  stripeNet,
  paymentsCount,
  activeSubsCount,
  periodLabel,
  productSegments,
  productTotal,
  tiers,
}: {
  recurrente: number;
  puntual: number;
  totalRev: number;
  stripeFees: number;
  stripeNet: number;
  paymentsCount: number;
  activeSubsCount: number;
  periodLabel?: string;
  productSegments: ProductRow[];
  productTotal: number;
  tiers: TierMrr[];
}) {
  const [tab, setTab] = useState<Tab>("fuentes");

  const recurrentePct = totalRev > 0 ? recurrente / totalRev : 0;
  const puntualPct = totalRev > 0 ? puntual / totalRev : 0;
  const maxProductRevenue = Math.max(...productSegments.map((s) => s.revenue), 0);
  const totalMrr = tiers.reduce((s, t) => s + t.mrr, 0);
  const totalArr = tiers.reduce((s, t) => s + t.arr, 0);
  const totalActive = tiers.reduce((s, t) => s + t.activeCount, 0);

  const meta = {
    fuentes: {
      subtitle: "Desglose entre ingresos recurrentes, pagos únicos y comisiones Stripe",
      dataSource: "Stripe payments export · Momence active subscriptions en vivo",
      sources: ["stripe", "momence"] as const,
      kpiItems: [
        { label: "Recurrentes", value: fmt(recurrente), valueClassName: "text-primary", helper: `${activeSubsCount} clientes · 2+ de 3 meses` },
        { label: "Pagos únicos", value: fmt(puntual), valueClassName: "text-income" },
        { label: "Neto banco", value: fmt(stripeNet) },
      ],
    },
    productos: {
      subtitle: "Distribución de ingresos por producto o tarifa en el período",
      dataSource: "Stripe + catálogo Momence en vivo",
      sources: ["stripe", "momence"] as const,
      kpiItems: undefined,
    },
    suscripciones: {
      subtitle: "Ingresos recurrentes mensuales y proyección anual por tier",
      dataSource: "MRR = suscriptores activos (no congelados) × precio del tier · Momence en vivo",
      sources: ["momence"] as const,
      kpiItems: [
        { label: "MRR total", value: fmt(totalMrr) },
        { label: "ARR proyectado", value: fmt(totalArr) },
        { label: "Suscriptores activos", value: String(totalActive) },
      ],
    },
  }[tab];

  return (
    <ChartCard
      title="Ingresos"
      subtitle={meta.subtitle}
      dateRange={tab === "fuentes" ? periodLabel : undefined}
      kpiItems={meta.kpiItems}
      toolbar={
        <ToggleGroup
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={TABS.map((t) => ({ value: t.key, label: t.label }))}
        />
      }
      dataSource={meta.dataSource}
      sources={[...meta.sources]}
    >
      {tab === "fuentes" && (
        <>
          {totalRev > 0 && (
            <ProportionBar
              className="mb-4"
              segments={[
                { label: "Recurrentes", color: "#4021c8", percentage: Math.round(recurrentePct * 100), displayValue: fmt(recurrente) },
                { label: "Pagos únicos", color: "#298a83", percentage: Math.round(puntualPct * 100), displayValue: fmt(puntual) },
              ]}
            />
          )}

          {stripeFees > 0 && (
            <div className="border border-navy/[0.07] rounded-xl overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-navy/[0.07]">
                <p className="text-[11px] font-medium uppercase tracking-wide text-navy/50">Comisiones Stripe</p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-navy/[0.06]">
                <div className="px-3.5 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-navy/45 mb-0.5">Bruto</p>
                  <p className="text-base font-medium text-navy">{fmt(totalRev)}</p>
                  <p className="text-[11px] text-navy/45">{paymentsCount} cobros</p>
                </div>
                <div className="px-3.5 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-navy/45 mb-0.5">Comisión</p>
                  <p className="text-base font-medium text-danger">−{fmt(stripeFees)}</p>
                  <p className="text-[11px] text-navy/45">{pct(totalRev > 0 ? stripeFees / totalRev : 0)} del bruto</p>
                </div>
                <div className="px-3.5 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-navy/45 mb-0.5">Neto</p>
                  <p className="text-base font-medium text-success">{fmt(stripeNet)}</p>
                  <p className="text-[11px] text-navy/45">al banco</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "productos" && (
        productSegments.length === 0 ? (
          <p className="text-sm text-navy/45 text-center py-10">Sin datos de productos.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-5">
              <p className="text-xs text-navy/45 font-medium">Ingresos totales</p>
              <p className="text-2xl font-bold text-navy tabular-nums leading-tight">{fmt(productTotal)}</p>
            </div>

            <div className="space-y-3">
              {productSegments.map((seg) => (
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
                      style={{ width: `${Math.max((maxProductRevenue > 0 ? seg.revenue / maxProductRevenue : 0) * 100, 2)}%`, backgroundColor: seg.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {tab === "suscripciones" && (
        <>
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
        </>
      )}
    </ChartCard>
  );
}
