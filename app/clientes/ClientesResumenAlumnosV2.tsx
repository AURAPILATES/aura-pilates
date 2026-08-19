"use client";

import { useEffect, useState } from "react";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import { IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import { tableHeadClassV2, tableRowClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { fmt } from "@/lib/analytics";
import type { Period } from "@/app/analitica/instances/evolucionIngresosUtils";
import type { PeriodCell, SummaryRow } from "./ClientesResumenAlumnos";
import ClientesResumenAlumnosGuiaDrawer from "./ClientesResumenAlumnosGuiaDrawer";

/** Forma común a la fila Total y a cada fila de producto - permite reusar el mismo `value`/
 * `format` en ambas sin duplicar la fila Total aparte. */
type Row = { byPeriod: Record<string, PeriodCell>; totalCount: number; totalAmount: number };

type TotalRow = Row;

type Props = {
  period: Period;
  onPeriodChange: (p: Period) => void;
  periods: string[];
  periodLabel: (key: string) => string;
  rows: SummaryRow[];
  totalRow: TotalRow;
  onExportCsv: () => void;
};

const PERIOD_OPTIONS: Array<{ key: Period; label: string }> = [
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año", label: "Año" },
];

/** Una de las dos tablas apiladas (Alumnos o Importe): fila Total resaltada arriba (el total
 * por período que pedía Julia - antes solo se veía el desglose por producto, sin agregado) y
 * debajo el desglose por producto, misma estructura de columnas en ambas tablas. */
function SummaryTable({
  title, visiblePeriods, cols, rows, totalRow, periodLabel, value, format, totalValue,
}: {
  title: string;
  visiblePeriods: string[];
  cols: string;
  rows: SummaryRow[];
  totalRow: TotalRow;
  periodLabel: (key: string) => string;
  value: (row: Row, k: string) => number;
  format: (n: number) => string;
  totalValue: (row: Row) => number;
}) {
  return (
    <div className={`${tableCardClassV2} overflow-hidden`}>
      <div className="px-5 py-[9px] bg-[#fafaf8] dark:bg-white/[0.03] border-b border-border text-[10.5px] tracking-wide uppercase text-faint font-semibold">
        {title}
      </div>
      <div className="overflow-x-auto">
        <div className={`${tableHeadClassV2} px-5`} style={gridColsV2(cols)}>
          <span>Producto</span>
          {visiblePeriods.map((k) => (
            <span key={k} className="text-center whitespace-nowrap">{periodLabel(k)}</span>
          ))}
          <span className="text-right">Total</span>
        </div>

        <div className={`${tableRowClassV2} px-5 bg-navy/[0.025]`} style={gridColsV2(cols)}>
          <p className="font-bold text-navy text-[13.5px]">Total</p>
          {visiblePeriods.map((k) => {
            const n = value(totalRow, k);
            return (
              <p key={k} className="text-center text-[13px] font-bold text-navy tabular-nums">{n === 0 ? "-" : format(n)}</p>
            );
          })}
          <p className="text-right font-bold text-navy text-[13.5px] tabular-nums">{format(totalValue(totalRow))}</p>
        </div>

        {rows.map((row) => (
          <div key={row.product} className={`${tableRowClassV2} px-5`} style={gridColsV2(cols)}>
            <p className="font-semibold text-navy truncate text-[13.5px]">{row.product}</p>
            {visiblePeriods.map((k) => {
              const n = value(row, k);
              return (
                <p key={k} className="text-center text-[12.5px] text-muted tabular-nums">{n === 0 ? "-" : format(n)}</p>
              );
            })}
            <p className="text-right font-semibold text-navy text-[13.5px] tabular-nums">{format(totalValue(row))}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pestaña "Resumen alumnos" de Clientes: cuántas alumnas distintas y cuánto ingresó cada
 * producto por mes/trimestre/año, con un total agregado arriba de cada tabla - sustituye a la
 * antigua vista "Por producto" de Historial de compras (mismo criterio de datos, ver
 * ClientesResumenAlumnosGuiaDrawer). */
export default function ClientesResumenAlumnosV2({ period, onPeriodChange, periods, periodLabel, rows, totalRow, onExportCsv }: Props) {
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
  const visiblePeriods = collapsed ? periods.slice(-1) : periods;
  const cols = `minmax(120px,1.6fr) repeat(${visiblePeriods.length}, minmax(64px, 1fr)) minmax(80px,.9fr)`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <FilterPillGroupV2
            variant="segmented"
            active={period}
            onChange={onPeriodChange}
            options={PERIOD_OPTIONS}
          />
          <ClientesResumenAlumnosGuiaDrawer />
        </div>
        <div className="flex items-center gap-2">
          {isMobile && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[12px] font-medium text-navy underline underline-offset-2"
            >
              {expanded ? "Ver resumen (último período)" : `Ver todos (${periods.length})`}
            </button>
          )}
          <IconButtonV2 onClick={onExportCsv} title="Exportar a CSV">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
            </svg>
          </IconButtonV2>
        </div>
      </div>

      <div className="mt-3">
        <SummaryTable
          title="Alumnos (nº)"
          visiblePeriods={visiblePeriods}
          cols={cols}
          rows={rows}
          totalRow={totalRow}
          periodLabel={periodLabel}
          value={(row, k) => row.byPeriod[k]?.count ?? 0}
          format={(n) => String(n)}
          totalValue={(row) => row.totalCount}
        />
      </div>
      <div className="mt-5">
        <SummaryTable
          title="Importe"
          visiblePeriods={visiblePeriods}
          cols={cols}
          rows={rows}
          totalRow={totalRow}
          periodLabel={periodLabel}
          value={(row, k) => row.byPeriod[k]?.amount ?? 0}
          format={fmt}
          totalValue={(row) => row.totalAmount}
        />
      </div>
    </div>
  );
}
