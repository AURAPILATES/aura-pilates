"use client";

import { ChartCard } from "@/components/charts";

function fmt(v: number) {
  return Math.round(v).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

export type CockpitFinancieroProps = {
  curMonthLabel: string;
  avgMonthlyRevenue: number;
  revenueBasisLabel: string;
  lastUpdated?: string | null;
  ahorroBruto: number;
  ahorroNeto: number;
};

export default function CockpitFinanciero({
  curMonthLabel,
  avgMonthlyRevenue,
  revenueBasisLabel,
  lastUpdated,
  ahorroBruto,
  ahorroNeto,
}: CockpitFinancieroProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* INGRESOS */}
      <ChartCard
        title="Previsión de ingresos"
        dateRange={curMonthLabel}
        dataSource="Media de ventas brutas de los últimos 3 meses completos (Stripe + USC)."
        sources={["stripe", "momence"]}
        lastUpdated={lastUpdated}
      >
        <div className="text-[32px] font-semibold text-navy leading-tight tracking-tight">
          {fmt(avgMonthlyRevenue)}
        </div>
        <div className="text-[11px] text-navy/50 mt-0.5">{revenueBasisLabel}</div>
      </ChartCard>

      {/* AHORRO */}
      <ChartCard
        title="Ahorro mensual"
        dateRange={curMonthLabel}
        dataSource="Bruto = ingresos previstos − gastos comprometidos. Neto = bruto − comisión Stripe estimada − IVA neto del trimestre prorrateado a un mes. Las retenciones no se restan: ya salen netas del pago al contacto."
        sources={["stripe", "excel"]}
        lastUpdated={lastUpdated}
      >
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
      </ChartCard>
    </div>
  );
}
