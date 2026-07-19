"use client";

import dynamic from "next/dynamic";
import type { ActiveCustomersRow } from "@/lib/stripePayments";
import { ChartCard } from "@/components/charts";

const EvolucionInscritosBody = dynamic(() => import("./EvolucionInscritosBody"), {
  ssr: false,
  loading: () => <div className="h-[200px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

export default function EvolucionInscritos({ data }: { data: ActiveCustomersRow[] }) {
  if (data.length === 0) {
    return <ChartCard title="Evolución de clientes activos" subtitle="Clientes con suscripción o pack vigente al cierre de cada mes." />;
  }

  const last = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : null;
  const peak = data.reduce((best, d) => (d.count > best.count ? d : best), data[0]);
  const vsPrevPct = prev && prev.count > 0 ? Math.round(((last.count - prev.count) / prev.count) * 100) : null;

  const COMPOSITION = [
    { key: "subscriptions", label: "Suscripciones", color: "#7F77DD", value: last.subscriptions },
    { key: "packs", label: "Packs", color: "#AFA9EC", value: last.packs },
  ];
  const compositionTotal = last.count;

  return (
    <ChartCard
      title="Evolución de clientes activos"
      subtitle="Clientes con suscripción o pack vigente al cierre de cada mes."
      dateRange="Desde apertura"
      kpiItems={[
        { label: `Activos ${last.label.split(" ")[0].toLowerCase()}`, value: String(last.count), valueClassName: "text-primary" },
        {
          label: "Pico histórico",
          value: <>{peak.count} <span className="text-xs text-navy/50 font-normal">{peak.label.split(" ")[0].toLowerCase()}</span></>,
        },
        {
          label: "Vs mes ant.",
          value: vsPrevPct !== null ? `${vsPrevPct >= 0 ? "+" : ""}${vsPrevPct}%` : "—",
          valueClassName: vsPrevPct === null ? "text-navy/50" : vsPrevPct >= 0 ? "text-success" : "text-danger",
        },
      ]}
      dataSource="Suscripción (vigencia 31 días) o pack (15–90 días según tipo) según último pago en Stripe"
      sources={["stripe"]}
      lastUpdated="ahora"
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 min-w-0">
          <EvolucionInscritosBody data={data} />
        </div>
        <div className="lg:col-span-1 min-w-0">
          <p className="text-xs font-medium text-navy/55 mb-2.5">Resumen</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-navy/5 mb-4">
            {COMPOSITION.map((s) => (
              <div
                key={s.key}
                style={{ flex: `${compositionTotal > 0 ? s.value / compositionTotal : 0} 0 0%`, backgroundColor: s.color }}
              />
            ))}
          </div>
          <div className="space-y-2.5">
            {COMPOSITION.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-navy/70 truncate">{s.label}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold text-navy tabular-nums">{s.value}</span>
                  <span className="text-[11px] text-navy/40 ml-1">{compositionTotal > 0 ? `${Math.round(s.value / compositionTotal * 100)}%` : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
