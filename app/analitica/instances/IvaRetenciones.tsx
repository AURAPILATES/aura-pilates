"use client";

import { Calendar } from "react-feather";
import { ChartCard } from "@/components/charts";
import { fmt } from "@/lib/analytics";

export type QuarterlyFiscalRow = {
  quarter: string;
  ivaRepercutido: number;
  ivaSoportado: number;
  ivaNeto: number;
  retenciones: number;
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
  lastUpdated?: string | null;
};

function ResultPill({ negative }: { negative: boolean }) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
      negative ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
    }`}>
      {negative ? "A favor" : "A pagar"}
    </span>
  );
}

/** Formatea "2026-Q3" como "T3 2026". */
function quarterShort(q: string): string {
  const [year, qn] = q.split("-Q");
  return `T${qn} ${year}`;
}

export default function IvaRetenciones({
  quarterLabel, ivaRepercutido, ivaSoportado, ivaNeto, retenciones, dueLabel, quarterClosed, rows, lastUpdated,
}: Props) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChartCard
          title="IVA"
          dateRange={quarterLabel}
          dataSource="IVA repercutido: 21% extraído del bruto de ventas (Stripe + USC). IVA soportado: según el % de IVA asignado por contacto en cada gasto importado."
          sources={["stripe", "excel"]}
        >
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-[32px] font-semibold text-navy tracking-tight leading-none">{fmt(Math.abs(ivaNeto))}</span>
            <ResultPill negative={ivaNeto < 0} />
          </div>
          <div className="space-y-1.5 pt-3 border-t border-border">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-navy/50">IVA repercutido</span>
              <span className="font-medium text-navy tabular-nums">{fmt(ivaRepercutido)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-navy/50">IVA soportado</span>
              <span className="font-medium text-navy tabular-nums">− {fmt(ivaSoportado)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-navy/45 mt-3">
            <Calendar size={12} className="shrink-0" />
            Vence en {dueLabel}{!quarterClosed && " · trimestre en curso"}
          </div>
        </ChartCard>

        <ChartCard
          title="IRPF"
          dateRange={quarterLabel}
          dataSource="Retenciones practicadas: según el % de IRPF asignado por contacto en cada gasto importado (nóminas, alquileres, profesionales)."
          sources={["excel"]}
        >
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="text-[32px] font-semibold text-navy tracking-tight leading-none">{fmt(retenciones)}</span>
            <ResultPill negative={false} />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-navy/45 mt-3 pt-3 border-t border-border">
            <Calendar size={12} className="shrink-0" />
            Vence en {dueLabel}{!quarterClosed && " · trimestre en curso"}
          </div>
        </ChartCard>
      </div>

      <ChartCard
        title="IVA y retenciones por trimestre"
        subtitle="Según el IVA/retención asignado por contacto al importar (Configuración → Contactos)"
        sources={["excel"]}
        lastUpdated={lastUpdated}
      >
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
      </ChartCard>
    </>
  );
}
