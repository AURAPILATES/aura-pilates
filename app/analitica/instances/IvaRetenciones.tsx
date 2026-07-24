"use client";

import { useState } from "react";
import { ChevronRight } from "react-feather";
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

function fmtOrDash(v: number): string {
  return v === 0 ? "-" : fmt(v);
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
    <div className={`w-9 h-9 shrink-0 rounded-[8px] flex flex-col items-center justify-center ${URGENCY_STYLES[level]}`}>
      <span className="text-[12px] font-semibold leading-none">{d.getDate()}</span>
      <span className="text-[7.5px] font-semibold uppercase tracking-wide mt-0.5">{MONTH_SHORT[d.getMonth()]}</span>
    </div>
  );
}

/** Badge "A pagar"/"A favor" - igual paleta semántica que el resto de la app (success/danger). */
function ResultBadge({ favorable }: { favorable: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-semibold ${
        favorable ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {favorable ? "A favor" : "A pagar"}
    </span>
  );
}

export default function IvaRetenciones({
  quarterLabel, ivaRepercutido, ivaSoportado, ivaNeto, retenciones, dueLabel, quarterClosed, rows, obligations, lastUpdated,
}: Props) {
  const [ivaExpanded, setIvaExpanded] = useState(false);
  const quarterStatus = quarterClosed ? "trimestre cerrado" : "trimestre en curso";

  const kpiItems: MultiKpiItem[] = [
    {
      label: `IVA · ${quarterStatus}`,
      value: (
        <span className="inline-flex items-center gap-2">
          {fmt(Math.abs(ivaNeto))}
          <ResultBadge favorable={ivaNeto < 0} />
        </span>
      ),
      valueClassName: ivaNeto < 0 ? "text-success" : "text-navy",
      tooltip: "Repercutido: 21% extraído del bruto de ventas (Stripe + Urban Sports Club). Soportado: según el % de IVA asignado por contacto en cada gasto importado (Configuración → Contactos). Resultado = repercutido − soportado.",
      helper: (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-navy/45">
          <span>Repercutido (Ventas) {fmt(ivaRepercutido)}</span>
          <span>Soportado (Gastos) {fmt(ivaSoportado)}</span>
        </div>
      ),
    },
    {
      label: `IRPF · ${quarterStatus}`,
      value: fmt(retenciones),
      tooltip: "Retenciones practicadas según el % de IRPF asignado por contacto (nóminas, alquileres, profesionales) en cada gasto importado.",
    },
  ];

  return (
    <ChartCard
      title="Impuestos aproximados"
      subtitle={`Próximo vencimiento: ${dueLabel}`}
      dateRange={quarterLabel}
      kpiItems={kpiItems}
      dataSource="IVA repercutido: 21% extraído del bruto de ventas (Stripe + USC). IVA soportado y retenciones: según el % de IVA/IRPF asignado por contacto en cada gasto importado."
      sources={["stripe", "excel"]}
      lastUpdated={lastUpdated}
    >
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold text-navy/55 uppercase tracking-wide mb-3">Por trimestre</p>
          {rows.length === 0 ? (
            <p className="text-sm text-navy/40">Todavía no hay movimientos con IVA o retención asignados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-medium text-navy/45 pb-2 pr-3"></th>
                    {rows.map((r) => (
                      <th key={r.quarter} className="text-right font-medium text-navy/45 pb-2 px-3 whitespace-nowrap">
                        {quarterShort(r.quarter)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2.5 pr-3 text-navy/50 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setIvaExpanded((v) => !v)}
                        className="flex items-center gap-1 hover:text-navy/70 transition-colors"
                      >
                        <ChevronRight size={13} className={`shrink-0 text-navy/35 transition-transform ${ivaExpanded ? "rotate-90" : ""}`} />
                        IVA
                      </button>
                    </td>
                    {rows.map((r) => (
                      <td key={r.quarter} className={`py-2.5 px-3 text-right tabular-nums ${r.ivaNeto < 0 ? "text-success" : "text-navy/70"}`}>
                        {fmtOrDash(r.ivaNeto)}
                      </td>
                    ))}
                  </tr>
                  {ivaExpanded && (
                    <>
                      <tr className="border-b border-border">
                        <td className="py-2 pl-4 pr-3 text-navy/50 whitespace-nowrap">Repercutido (Ventas)</td>
                        {rows.map((r) => (
                          <td key={r.quarter} className="py-2 px-3 text-right text-navy/70 tabular-nums">{fmtOrDash(r.ivaRepercutido)}</td>
                        ))}
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 pl-4 pr-3 text-navy/50 whitespace-nowrap">Soportado (Gastos)</td>
                        {rows.map((r) => (
                          <td key={r.quarter} className="py-2 px-3 text-right text-navy/70 tabular-nums">
                            {r.ivaSoportado === 0 ? "-" : `− ${fmt(r.ivaSoportado)}`}
                          </td>
                        ))}
                      </tr>
                    </>
                  )}
                  <tr className="border-b border-border">
                    <td className="py-2.5 pr-3 text-navy/50 whitespace-nowrap">IRPF</td>
                    {rows.map((r) => (
                      <td key={r.quarter} className="py-2.5 px-3 text-right text-navy/70 tabular-nums">{fmtOrDash(r.retenciones)}</td>
                    ))}
                  </tr>
                  <tr className="last:border-0 bg-navy/[0.035]">
                    <td className="py-2.5 pr-3 font-semibold text-navy whitespace-nowrap rounded-l-[6px]">Total</td>
                    {rows.map((r, i) => {
                      const total = r.ivaNeto + r.retenciones;
                      return (
                        <td
                          key={r.quarter}
                          className={`py-2.5 px-3 text-right font-semibold text-navy tabular-nums ${i === rows.length - 1 ? "rounded-r-[6px]" : ""}`}
                        >
                          {fmtOrDash(total)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold text-navy/40 uppercase tracking-wide mb-2">Próximas obligaciones</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {obligations.map((o) => {
              const level = urgencyOf(o.days);
              return (
                <div key={o.label} className="flex items-center gap-2 rounded-[8px] border border-border px-2.5 py-2">
                  <ObligationDayBadge deadline={o.deadline} level={level} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-navy/80 truncate">{o.label}</p>
                    <p className="text-[11px] text-navy/45">{o.days < 0 ? `Venció hace ${-o.days} d` : o.days === 0 ? "Vence hoy" : `En ${o.days} días`}</p>
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
