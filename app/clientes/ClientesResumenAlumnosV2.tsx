"use client";

import { useEffect, useState } from "react";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import { IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import { tableHeadClassV2, tableRowClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { fmt } from "@/lib/analytics";
import type { Period } from "@/app/analitica/instances/evolucionIngresosUtils";
import type { PeriodCell, SummaryRow } from "./ClientesResumenAlumnos";

/** Forma común a la fila superior (agregado) y a cada fila de producto - permite reusar el
 * mismo `value`/`format` en ambas sin tratar el agregado aparte. */
type Row = { byPeriod: Record<string, PeriodCell>; totalCount: number; totalAmount: number };

type TotalRow = Row;

type Metric = "alumnos" | "importe";

type Props = {
  period: Period;
  onPeriodChange: (p: Period) => void;
  periods: string[];
  periodLabel: (key: string) => string;
  rows: SummaryRow[];
  totalRow: TotalRow;
  onExportCsv: () => void;
};

const METRIC_OPTIONS: Array<{ key: Metric; label: string }> = [
  { key: "alumnos", label: "Alumnos" },
  { key: "importe", label: "Importe" },
];

const PERIOD_OPTIONS: Array<{ key: Period; label: string }> = [
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año", label: "Año" },
];

/** Tabla de Resumen alumnos: fila superior resaltada con el agregado (alumnos distintos sin
 * doble conteo, o importe sumado - el toggle Alumnos/Importe decide cuál) y debajo el desglose
 * por producto. Etiquetada "Alumnos"/"Importe" en vez de "Total": el toggle ya deja claro qué
 * mide, así que repetir "Total" ahí era redundante. */
function SummaryTable({
  rowLabel, visiblePeriods, cols, rows, totalRow, periodLabel, value, format, totalValue,
}: {
  rowLabel: string;
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
    <div className={`mt-3 -mx-4 sm:-mx-6 ${tableCardClassV2} overflow-hidden`}>
      <div className="overflow-x-auto">
        <div className={`${tableHeadClassV2} px-5`} style={gridColsV2(cols)}>
          <span>Producto</span>
          {visiblePeriods.map((k) => (
            <span key={k} className="text-center whitespace-nowrap">{periodLabel(k)}</span>
          ))}
          <span className="text-right">Total</span>
        </div>

        <div className={`${tableRowClassV2} px-5 bg-navy/[0.025]`} style={gridColsV2(cols)}>
          <p className="font-bold text-navy text-[13.5px]">{rowLabel}</p>
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
 * producto por mes/trimestre/año - sustituye a la antigua vista "Por producto" de Historial de
 * compras (mismo criterio de datos, ver ClientesResumenAlumnosGuiaDrawer). Toggle Alumnos/
 * Importe en vez de dos tablas apiladas: son la misma tabla, solo cambia qué valor se pinta. */
export default function ClientesResumenAlumnosV2({ period, onPeriodChange, periods, periodLabel, rows, totalRow, onExportCsv }: Props) {
  const [metric, setMetric] = useState<Metric>("alumnos");
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

  const value = metric === "alumnos"
    ? (row: Row, k: string) => row.byPeriod[k]?.count ?? 0
    : (row: Row, k: string) => row.byPeriod[k]?.amount ?? 0;
  const format = metric === "alumnos" ? (n: number) => String(n) : fmt;
  const totalValue = metric === "alumnos" ? (row: Row) => row.totalCount : (row: Row) => row.totalAmount;
  const rowLabel = metric === "alumnos" ? "Alumnos" : "Importe";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <FilterPillGroupV2
            variant="segmented"
            active={metric}
            onChange={setMetric}
            options={METRIC_OPTIONS}
          />
          <FilterPillGroupV2
            variant="segmented"
            active={period}
            onChange={onPeriodChange}
            options={PERIOD_OPTIONS}
          />
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

      <SummaryTable
        rowLabel={rowLabel}
        visiblePeriods={visiblePeriods}
        cols={cols}
        rows={rows}
        totalRow={totalRow}
        periodLabel={periodLabel}
        value={value}
        format={format}
        totalValue={totalValue}
      />
    </div>
  );
}
