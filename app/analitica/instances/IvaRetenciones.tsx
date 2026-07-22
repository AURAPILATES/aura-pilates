"use client";

import { Calendar } from "react-feather";
import { ChartCard, type MultiKpiItem } from "@/components/charts";
import { fmt } from "@/lib/analytics";

export type QuarterlyFiscalRow = {
  quarter: string;
  ivaRepercutido: number;
  ivaSoportado: number;
  ivaNeto: number;
  retenciones: number;
};

export type FiscalObligation = {
  label: string;
  deadline: string;
  days: number;
};

type Props = {
  quarterLabel: string;
  ivaRepercutido: number;
  ivaSoportado: number;
  ivaNeto: number;
  retenciones: number;
  dueLabel: string;
  quarterClosed: boolean;
  rows: QuarterlyFiscalRow[];
  obligations: FiscalObligation[];
  lastUpdated?: string | null;
};

/** Formatea "2026-Q3" como "T3 2026". */
function quarterShort(q: string): string {
  const [year, qn] = q.split("-Q");
  return `T${qn} ${year}`;
}

const MONTH_SHORT = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function urgencyOf(days: number): "danger" | "warning" | "neutral" {
  if (days <= 30) return "danger";
  if (days <= 60) return "warning";
  return "neutral";
}

const URGENCY_STYLES = {
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  neutral: "bg-navy/5 text-navy/70",
} as const;

function ObligationDayBadge({ deadline, level }: { deadline: string; level: keyof typeof URGENCY_STYLES }) {
  const d = new Date(deadline + "T12:00:00");
  return (
    <div className={`w-12 h-12 shrink-0 rounded-[10px] flex flex-col items-center justify-center ${URGENCY_STYLES[level]}`}>
      <span className="text-[15px] font-semibold leading-none">{d.getDate()}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide mt-1">{MONTH_SHORT[d.getMonth()]}</span>
    </div>
  );
}

export default function IvaRetenciones({
  quarterLabel, ivaRepercutido, ivaSoportado, ivaNeto, retenciones, dueLabel, quarterClosed, rows, obligations, lastUpdated,
}: Props) {
  const kpiItems: MultiKpiItem[] = [
    {
      label: "IVA (resultado)",
      value: fmt(Math.abs(ivaNeto)),
      valueClassName: ivaNeto < 0 ? "text-success" : "text-navy",
      helper: <span className={ivaNeto < 0 ? "text-success" : "text-danger"}>{ivaNeto < 0 ? "A favor" : "A pagar"}</span>,
    },
    { label: "IRPF retenido", value: fmt(retenciones), helper: "Practicado a contactos" },
  ];

  return (
    <ChartCard
      title="Impuestos"
      subtitle="IVA repercutido y soportado, retenciones practicadas y próximos vencimientos fiscales"
      dateRange={quarterLabel}
      kpiItems={kpiItems}
      dataSource="IVA repercutido: 21% extraído del bruto de ventas (Stripe + USC). IVA soportado y retenciones: según el % de IVA/IRPF asignado por contacto en cada gasto importado."
      sources={["stripe", "excel"]}
      lastUpdated={lastUpdated}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-navy/55 uppercase tracking-wide mb-2">IVA</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-navy/50">IVA repercutido</span>
                <span className="font-medium text-navy tabular-nums">{fmt(ivaRepercutido)}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-navy/50">IVA soportado</span>
                <span className="font-medium text-navy tabular-nums">− {fmt(ivaSoportado)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-navy/45 mt-2.5">
              <Calendar size={12} className="shrink-0" />
              Vence en {dueLabel}{!quarterClosed && " · trimestre en curso"}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-navy/55 uppercase tracking-wide mb-2">IRPF</p>
            <p className="text-[13px] text-navy/50 leading-relaxed">
              Retenciones practicadas según el % de IRPF asignado por contacto (nóminas, alquileres, profesionales).
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-navy/45 mt-2.5">
              <Calendar size={12} className="shrink-0" />
              Vence en {dueLabel}{!quarterClosed && " · trimestre en curso"}
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-navy/55 uppercase tracking-wide mb-3">Por trimestre</p>
          {rows.length === 0 ? (
            <p className="text-sm text-navy/40">Todavía no hay movimientos con IVA o retención asignados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-medium text-navy/45 pb-2 pr-3">Trimestre</th>
                    <th className="text-right font-medium text-navy/45 pb-2 px-3">IVA repercutido</th>
                    <th className="text-right font-medium text-navy/45 pb-2 px-3">IVA soportado</th>
                    <th className="text-right font-medium text-navy/45 pb-2 px-3">IVA (resultado)</th>
                    <th className="text-right font-medium text-navy/45 pb-2 pl-3">Retenciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.quarter} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-navy whitespace-nowrap">{quarterShort(r.quarter)}</td>
                      <td className="py-2.5 px-3 text-right text-navy/70 tabular-nums">{fmt(r.ivaRepercutido)}</td>
                      <td className="py-2.5 px-3 text-right text-navy/70 tabular-nums">{fmt(r.ivaSoportado)}</td>
                      <td className={`py-2.5 px-3 text-right font-semibold tabular-nums ${r.ivaNeto < 0 ? "text-success" : "text-navy"}`}>
                        {fmt(r.ivaNeto)}
                      </td>
                      <td className="py-2.5 pl-3 text-right text-navy/70 tabular-nums">{fmt(r.retenciones)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-navy/55 uppercase tracking-wide mb-3">Próximas obligaciones</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {obligations.map((o) => {
              const level = urgencyOf(o.days);
              return (
                <div key={o.label} className="flex items-center gap-3 rounded-[10px] border border-border px-3 py-2.5">
                  <ObligationDayBadge deadline={o.deadline} level={level} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy truncate">{o.label}</p>
                    <p className="text-xs text-navy/50">{o.days <= 0 ? "Vence hoy" : `En ${o.days} días`}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
