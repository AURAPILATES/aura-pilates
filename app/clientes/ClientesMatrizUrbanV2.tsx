"use client";

import { useState, useEffect, type ReactNode } from "react";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import { IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import ClearFiltersButtonV2 from "@/app/components/v2/ClearFiltersButtonV2";
import { tableHeadClassV2, tableRowClassV2, tableFootClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { fmt } from "@/lib/analytics";
import { monthLabel } from "./ClientesMatrizCompras";
import type { UrbanClientRow } from "@/lib/clientActivityV2";
import type { UrbanSortKey } from "./ClientesMatrizUrban";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  onlyInactive: boolean;
  onToggleOnlyInactive: () => void;
  lastMonth: string | undefined;
  months: string[];
  rows: UrbanClientRow[];
  sortKey: UrbanSortKey;
  sortDir: "asc" | "desc";
  onToggleSort: (k: UrbanSortKey) => void;
  monthTotals: Record<string, number>;
  grandTotalClasses: number;
  grandTotalEstimated: number;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onRowClick: (row: UrbanClientRow) => void;
  onExportCsv: () => void;
  /** Control extra al final de la barra de búsqueda/filtros (p.ej. el switch de procedencia
   * Momence/Urban en Clientes › Historial). */
  extraControls?: ReactNode;
};

function sortArrow(active: boolean, dir: "asc" | "desc") {
  if (!active) return null;
  return <span className="text-muted">{dir === "asc" ? " ▲" : " ▼"}</span>;
}

export default function ClientesMatrizUrbanV2({
  search, onSearchChange, onlyInactive, onToggleOnlyInactive, lastMonth, months, rows,
  sortKey, sortDir, onToggleSort, monthTotals, grandTotalClasses, grandTotalEstimated,
  totalCount, page, pageSize, onPageChange, onRowClick, onExportCsv,
  extraControls,
}: Props) {
  // En móvil hay demasiadas columnas de mes para que quepan sin scroll horizontal ilegible:
  // por defecto se muestra solo el último mes + Total, con un botón para "Ampliar" (mismo
  // patrón que Historial de compras, ver ClientesMatrizComprasV2).
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
  const showFirstClass = !collapsed;
  const cols = `minmax(140px,2fr) ${showFirstClass ? "minmax(90px,1.1fr) " : ""}repeat(${visibleMonths.length}, minmax(56px, 1fr)) minmax(90px,1.1fr)`;
  const activeFilterCount = (onlyInactive ? 1 : 0) + (search.trim() ? 1 : 0);

  function clearFilters() {
    onSearchChange("");
    if (onlyInactive) onToggleOnlyInactive();
  }

  return (
    <div>
      <div className="flex items-center gap-[9px] flex-wrap">
        {extraControls}
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar cliente…" className="min-w-[160px] flex-1" />
        <button
          type="button"
          onClick={onToggleOnlyInactive}
          className={`text-[13px] px-[13px] py-2 rounded-[10px] border whitespace-nowrap transition-colors ${
            onlyInactive ? "border-navy bg-navy text-app-bg font-medium" : "border-border bg-card text-strong hover:bg-navy/[0.02]"
          }`}
        >
          Sin clase en {lastMonth ? monthLabel(lastMonth) : "el último mes"}
        </button>
        {activeFilterCount >= 1 && <ClearFiltersButtonV2 onClick={clearFilters} className="hidden sm:flex" />}
        <IconButtonV2 onClick={onExportCsv} title="Exportar vista actual a CSV" className="sm:ml-auto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
          </svg>
        </IconButtonV2>
      </div>

      {activeFilterCount >= 1 && (
        <div className="sm:hidden mt-2">
          <ClearFiltersButtonV2 onClick={clearFilters} />
        </div>
      )}

      {isMobile && (
        <div className="flex justify-start mt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[12px] font-medium text-navy underline underline-offset-2"
          >
            {expanded ? "Ver resumen (último mes)" : `Ver todos los meses (${months.length})`}
          </button>
        </div>
      )}

      <div className={`${isMobile ? "mt-2" : "mt-[24px]"} -mx-4 sm:-mx-6 ${tableCardClassV2} overflow-hidden`}>
        <div className="overflow-x-auto">
          <div className={`${tableHeadClassV2} px-5`} style={gridColsV2(cols)}>
            <span
              className={`cursor-pointer select-none ${sortKey === "name" ? "text-navy" : ""}`}
              onClick={() => onToggleSort("name")}
            >
              Cliente{sortArrow(sortKey === "name", sortDir)}
            </span>
            {showFirstClass && (
              <span
                className={`cursor-pointer select-none ${sortKey === "first" ? "text-navy" : ""}`}
                onClick={() => onToggleSort("first")}
              >
                Primera clase{sortArrow(sortKey === "first", sortDir)}
              </span>
            )}
            {visibleMonths.map((m) => (
              <span key={m} className="text-center whitespace-nowrap">{monthLabel(m)}</span>
            ))}
            <span
              className={`text-right cursor-pointer select-none ${sortKey === "total" ? "text-navy" : ""}`}
              onClick={() => onToggleSort("total")}
            >
              Total{sortArrow(sortKey === "total", sortDir)}
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="py-6 px-5 text-center text-faint text-sm">Sin resultados</div>
          ) : (
            rows.map((row) => (
              <div
                key={row.memberId}
                onClick={() => onRowClick(row)}
                className={`${tableRowClassV2} px-5 cursor-pointer`}
                style={gridColsV2(cols)}
              >
                <p className="font-semibold text-navy truncate text-[13.5px]" title={row.name}>
                  {row.name}
                </p>
                {showFirstClass && (
                  <p className="text-center text-muted text-[12.5px] whitespace-nowrap">
                    {row.firstClassDate ? monthLabel(row.firstClassDate.slice(0, 7)) : "-"}
                  </p>
                )}
                {visibleMonths.map((m) => {
                  const cell = row.byMonth[m];
                  if (!cell || cell.classes === 0) return <div key={m} />;
                  return (
                    <div key={m} className="flex justify-center">
                      <div className="rounded-[8px] px-1.5 py-1 flex flex-col items-center gap-0.5 bg-[#3b82f6]/10 text-[#3b82f6] min-w-[56px]">
                        <span className="text-[11.5px] font-semibold leading-tight tabular-nums">{cell.classes}</span>
                        <span className="text-[9px] opacity-70 leading-tight font-medium tabular-nums">{fmt(cell.estimated)}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="text-right">
                  <p className="font-semibold text-navy text-[13.5px] tabular-nums">{row.totalClasses}</p>
                  <p className="text-[10.5px] text-faint tabular-nums">{fmt(row.totalEstimated)}</p>
                </div>
              </div>
            ))
          )}

          {rows.length > 0 && (
            <div className={`${tableRowClassV2} px-5`} style={gridColsV2(cols)}>
              <p className="font-semibold text-muted text-[10.5px] uppercase tracking-wide">Total</p>
              {showFirstClass && <div />}
              {visibleMonths.map((m) => (
                <p key={m} className="text-center text-[10.5px] font-semibold text-muted tabular-nums">
                  {monthTotals[m] > 0 ? monthTotals[m] : "-"}
                </p>
              ))}
              <div className="text-right">
                <p className="text-[10.5px] font-bold text-navy tabular-nums">{grandTotalClasses}</p>
                <p className="text-[10.5px] font-semibold text-muted tabular-nums">{fmt(grandTotalEstimated)}</p>
              </div>
            </div>
          )}
        </div>
        {rows.length === 0 && <div className={tableFootClassV2} />}
        <TablePaginationV2 page={page} totalItems={totalCount} pageSize={pageSize} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
