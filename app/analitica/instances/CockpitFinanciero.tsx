"use client";

import { TrendingUp, FileText, DollarSign } from "react-feather";
import { ChartCard } from "@/components/charts";

function fmt(v: number) {
  return Math.round(v).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

export type CockpitFinancieroProps = {
  curMonthLabel: string;
  avgMonthlyRevenue: number;
  revenueBasisLabel: string;
  lastUpdated?: string | null;
  nextIvaLabel: string | null;
  nextIvaQuarter: string | null;
  ivaNeto: number;
  retenciones: number;
  ivaQuarterClosed: boolean;
  ahorroBruto: number;
  ahorroNeto: number;
};

export default function CockpitFinanciero({
  curMonthLabel,
  avgMonthlyRevenue,
  revenueBasisLabel,
  lastUpdated,
  nextIvaLabel,
  nextIvaQuarter,
  ivaNeto,
  retenciones,
  ivaQuarterClosed,
  ahorroBruto,
  ahorroNeto,
}: CockpitFinancieroProps) {
  return (
    <ChartCard
      title="Cockpit financiero"
      subtitle="Previsión de ingresos, IVA/IRPF y ahorro mensual"
      dateRange={curMonthLabel}
      dataSource="Ingresos: media de ventas brutas de los últimos 3 meses completos (Stripe + USC). IVA/IRPF: trimestre en curso, según reglas por contacto. Ahorro neto: ingresos − gastos comprometidos − comisión Stripe estimada − IVA neto mensualizado."
      sources={["stripe", "momence", "excel"]}
      lastUpdated={lastUpdated}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">

        {/* INGRESOS */}
        <div className="p-4 sm:pl-0">
          <div className="flex items-center gap-1.5 mb-4">
            <TrendingUp size={12} className="text-primary" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Previsión de ingresos</span>
          </div>
          <div className="text-[32px] font-semibold text-navy leading-tight tracking-tight">
            {fmt(avgMonthlyRevenue)}
          </div>
          <div className="text-[11px] text-navy/50 mt-0.5">{revenueBasisLabel}</div>
        </div>

        {/* FISCAL */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-4">
            <FileText size={12} className="text-navy/40" />
            <span className="text-[11px] font-semibold text-navy/40 uppercase tracking-wider">Previsión de IVA e IRPF</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[26px] font-medium leading-tight text-navy">{fmt(Math.abs(ivaNeto))}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
              ivaNeto >= 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
            }`}>
              {ivaNeto >= 0 ? "IVA a pagar" : "IVA a favor"}
            </span>
          </div>
          <div className="text-[11px] text-navy/50 mt-1">
            + {fmt(retenciones)} retenciones (IRPF)
          </div>
          <div className="text-[10px] text-navy/35 mt-0.5">
            {nextIvaQuarter ?? "—"} · vence {nextIvaLabel ?? "—"}{!ivaQuarterClosed && " (en curso)"}
          </div>
        </div>

        {/* AHORRO */}
        <div className="p-4 sm:pr-0">
          <div className="flex items-center gap-1.5 mb-4">
            <DollarSign size={12} className="text-income" />
            <span className="text-[11px] font-semibold text-income uppercase tracking-wider">Ahorro mensual</span>
          </div>
          <div className="mb-3">
            <div className="text-[11px] font-medium text-navy/45 mb-1">Bruto</div>
            <div className={`text-[26px] font-medium leading-tight ${ahorroBruto >= 0 ? "text-navy" : "text-danger"}`}>
              {fmt(ahorroBruto)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-navy/45 mb-1">Neto</div>
            <div className={`text-[20px] font-medium leading-tight ${ahorroNeto >= 0 ? "text-income" : "text-danger"}`}>
              {fmt(ahorroNeto)}
            </div>
            <div className="text-[11px] text-navy/50 mt-0.5">tras comisión Stripe e IVA neto</div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
