"use client";

import { useState, useEffect } from "react";
import { IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import { tableHeadClassV2, tableRowClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { fmt } from "@/lib/analytics";
import { monthLabel, type ProductRow } from "./ClientesMatrizCompras";

type Props = {
  months: string[];
  rows: ProductRow[];
  onExportCsv: () => void;
};

/** Una de las dos tablas apiladas (alumnos o importe) - misma estructura de filas/columnas,
 * solo cambia qué valor se pinta en cada celda. */
function ProductMonthTable({
  title, rows, visibleMonths, cols, value, format, total,
}: {
  title: string;
  rows: ProductRow[];
  visibleMonths: string[];
  cols: string;
  value: (row: ProductRow, month: string) => number;
  format: (n: number) => string;
  total: (row: ProductRow) => string;
}) {
  return (
    <div className={`${tableCardClassV2} overflow-hidden`}>
      <div className="px-5 py-[9px] bg-[#fafaf8] dark:bg-white/[0.03] border-b border-border text-[10.5px] tracking-wide uppercase text-faint font-semibold">
        {title}
      </div>
      <div className="overflow-x-auto">
        <div className={`${tableHeadClassV2} px-5`} style={gridColsV2(cols)}>
          <span>Producto</span>
          {visibleMonths.map((m) => (
            <span key={m} className="text-center whitespace-nowrap">{monthLabel(m)}</span>
          ))}
          <span className="text-right">Total</span>
        </div>
        {rows.map((row) => (
          <div key={row.product} className={`${tableRowClassV2} px-5`} style={gridColsV2(cols)}>
            <p className="font-semibold text-navy truncate text-[13.5px]">{row.product}</p>
            {visibleMonths.map((m) => {
              const n = value(row, m);
              return (
                <p key={m} className="text-center text-[12.5px] text-muted tabular-nums">{n === 0 ? "-" : format(n)}</p>
              );
            })}
            <p className="text-right font-semibold text-navy text-[13.5px] tabular-nums">{total(row)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Resumen "por producto" de Historial de compras: cuántos alumnos distintos compraron cada
 * producto cada mes, y cuánto ingresó por cada uno - Urban incluido (créditos estimados según
 * la tarifa de Config → Precios), a diferencia de la vista "por cliente" que no lo mezcla con
 * Stripe porque Urban no genera cobro individual. */
export default function ClientesMatrizProductoV2({ months, rows, onExportCsv }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const collapsed = isMobile && !expanded;
  const visibleMonths = collapsed ? months.slice(-1) : months;
  const cols = `minmax(120px,1.6fr) repeat(${visibleMonths.length}, minmax(64px, 1fr)) minmax(80px,.9fr)`;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        {isMobile ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[12px] font-medium text-navy underline underline-offset-2"
          >
            {expanded ? "Ver resumen (último mes)" : `Ver todos los meses (${months.length})`}
          </button>
        ) : <span />}
        <IconButtonV2 onClick={onExportCsv} title="Exportar a CSV">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
          </svg>
        </IconButtonV2>
      </div>

      <div className="mt-3">
        <ProductMonthTable
          title="Alumnos (nº)"
          rows={rows}
          visibleMonths={visibleMonths}
          cols={cols}
          value={(row, m) => row.byMonth[m]?.count ?? 0}
          format={(n) => String(n)}
          total={(row) => String(row.totalCount)}
        />
      </div>
      <div className="mt-5">
        <ProductMonthTable
          title="Alumnos (importe)"
          rows={rows}
          visibleMonths={visibleMonths}
          cols={cols}
          value={(row, m) => row.byMonth[m]?.amount ?? 0}
          format={fmt}
          total={(row) => fmt(row.totalAmount)}
        />
      </div>
    </div>
  );
}
