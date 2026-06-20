import { fmt, pct } from "@/lib/analytics";
import { ChartCard, ProportionBar } from "@/components/charts";

export default function FuentesIngreso({
  recurrente,
  puntual,
  totalRev,
  stripeFees,
  stripeNet,
  paymentsCount,
  activeSubsCount,
  periodLabel,
}: {
  recurrente: number;
  puntual: number;
  totalRev: number;
  stripeFees: number;
  stripeNet: number;
  paymentsCount: number;
  activeSubsCount: number;
  periodLabel?: string;
}) {
  const recurrentePct = totalRev > 0 ? recurrente / totalRev : 0;
  const puntualPct = totalRev > 0 ? puntual / totalRev : 0;

  return (
    <ChartCard
      title="Fuentes de ingreso"
      subtitle="Desglose entre ingresos recurrentes, pagos únicos y comisiones Stripe"
      dateRange={periodLabel}
      kpiItems={[
        { label: "Recurrentes", value: fmt(recurrente), valueClassName: "text-primary", helper: `${activeSubsCount} clientes · 2+ de 3 meses` },
        { label: "Pagos únicos", value: fmt(puntual), valueClassName: "text-income" },
        { label: "Neto banco", value: fmt(stripeNet) },
      ]}
      dataSource="Stripe payments export · Momence active subscriptions en vivo"
    >
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
    </ChartCard>
  );
}
