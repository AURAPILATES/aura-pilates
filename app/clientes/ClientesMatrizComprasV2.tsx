"use client";

import { useState, useEffect } from "react";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import Select from "@/app/components/Select";
import { IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import FiltersToggleButtonV2 from "@/app/components/v2/FiltersToggleButtonV2";
import ClearFiltersButtonV2 from "@/app/components/v2/ClearFiltersButtonV2";
import { tableHeadClassV2, tableRowClassV2, tableFootClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { fmt } from "@/lib/analytics";
import { PRODUCT_FILTERS, PURCHASE_COUNT_FILTERS, monthLabel, productAbbr, productColor, type MatrixRow, type SortKey } from "./ClientesMatrizCompras";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  productFilter: string;
  onProductFilterChange: (v: string) => void;
  firstPurchaseFilter: string;
  onFirstPurchaseFilterChange: (v: string) => void;
  purchaseCountFilter: string;
  onPurchaseCountFilterChange: (v: string) => void;
  onlyInactive: boolean;
  onToggleOnlyInactive: () => void;
  onlyUpsell: boolean;
  onToggleOnlyUpsell: () => void;
  lastMonth: string | undefined;
  months: string[];
  rows: MatrixRow[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onToggleSort: (k: SortKey) => void;
  monthTotals: Record<string, number>;
  grandTotal: number;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onRowClick: (c: MatrixRow["customer"]) => void;
  onExportCsv: () => void;
};

function sortArrow(active: boolean, dir: "asc" | "desc") {
  if (!active) return null;
  return <span className="text-muted">{dir === "asc" ? " ▲" : " ▼"}</span>;
}

export default function ClientesMatrizComprasV2({
  search, onSearchChange, productFilter, onProductFilterChange, firstPurchaseFilter, onFirstPurchaseFilterChange,
  purchaseCountFilter, onPurchaseCountFilterChange,
  onlyInactive, onToggleOnlyInactive, onlyUpsell, onToggleOnlyUpsell, lastMonth, months, rows,
  sortKey, sortDir, onToggleSort, monthTotals, grandTotal, totalCount, page, pageSize, onPageChange, onRowClick, onExportCsv,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  // En móvil hay demasiadas columnas de mes para que quepan sin scroll horizontal ilegible:
  // por defecto se muestra solo el último mes + Total, con un botón para "Ampliar" y ver la
  // matriz completa (esa vista sí exige scroll horizontal, es lo esperable).
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
  const showFirstPurchase = !collapsed;
  // Columnas flexibles con mínimo legible: la tabla ocupa el 100% del ancho disponible en
  // escritorio, y si no caben con ese mínimo (más probable en móvil expandido) el contenedor
  // hace scroll horizontal en vez de encoger las columnas hasta ser ilegibles.
  const cols = `minmax(140px,2fr) ${showFirstPurchase ? "minmax(90px,1.1fr) " : ""}repeat(${visibleMonths.length}, minmax(64px, 1fr)) minmax(90px,1.1fr)`;
  const filtersActive = !!productFilter || !!firstPurchaseFilter || !!purchaseCountFilter || onlyInactive || onlyUpsell;
  const activeFilterCount =
    (productFilter ? 1 : 0) + (firstPurchaseFilter ? 1 : 0) + (purchaseCountFilter ? 1 : 0) +
    (onlyInactive ? 1 : 0) + (onlyUpsell ? 1 : 0);
  function clearFilters() {
    onProductFilterChange("");
    onFirstPurchaseFilterChange("");
    onPurchaseCountFilterChange("");
    if (onlyInactive) onToggleOnlyInactive();
    if (onlyUpsell) onToggleOnlyUpsell();
    onSearchChange("");
  }

  return (
    <div>
      <div className="flex items-center gap-[9px] flex-wrap">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar cliente…" className="min-w-[160px] flex-1" />
        <FiltersToggleButtonV2 open={filtersOpen} active={filtersActive} onClick={() => setFiltersOpen((v) => !v)} />
        <IconButtonV2 onClick={onExportCsv} title="Exportar vista actual a CSV" className="sm:order-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
          </svg>
        </IconButtonV2>
        <div className={`${filtersOpen ? "flex" : "hidden"} sm:flex sm:order-1 items-center gap-[9px] flex-wrap w-full sm:w-auto`}>
          <Select variant="v2" value={productFilter} onChange={(e) => onProductFilterChange(e.target.value)} className="w-auto">
            <option value="">Todos los productos</option>
            {PRODUCT_FILTERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
          <Select variant="v2" value={firstPurchaseFilter} onChange={(e) => onFirstPurchaseFilterChange(e.target.value)} className="w-auto">
            <option value="">Primera compra: todas</option>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </Select>
          <Select variant="v2" value={purchaseCountFilter} onChange={(e) => onPurchaseCountFilterChange(e.target.value)} className="w-auto">
            <option value="">Nº de compras: todas</option>
            {PURCHASE_COUNT_FILTERS.map((n) => (
              <option key={n} value={n}>{n} compra{n === "1" ? "" : "s"}</option>
            ))}
          </Select>
          <button
            type="button"
            onClick={onToggleOnlyInactive}
            className={`text-[13px] px-[13px] py-2 rounded-[10px] border whitespace-nowrap transition-colors ${
              onlyInactive ? "border-navy bg-navy text-app-bg font-medium" : "border-border bg-card text-strong hover:bg-navy/[0.02]"
            }`}
          >
            Sin compra en {lastMonth ? monthLabel(lastMonth) : "el último mes"}
          </button>
          <button
            type="button"
            onClick={onToggleOnlyUpsell}
            title="Clientes en Bàsic desde hace 3 meses o más que nunca han subido a Plus o Pro"
            className={`text-[13px] px-[13px] py-2 rounded-[10px] border whitespace-nowrap transition-colors ${
              onlyUpsell ? "border-navy bg-navy text-app-bg font-medium" : "border-border bg-card text-strong hover:bg-navy/[0.02]"
            }`}
          >
            Candidatos a upsell
          </button>
          {activeFilterCount >= 1 && (
            <ClearFiltersButtonV2 onClick={clearFilters} className="hidden sm:flex" />
          )}
        </div>
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

      <div className={`${isMobile ? "mt-2" : "mt-[24px]"} ${tableCardClassV2}`}>
        <div className="overflow-x-auto">
          <div className={tableHeadClassV2} style={gridColsV2(cols)}>
            <span
              className={`cursor-pointer select-none ${sortKey === "name" ? "text-navy" : ""}`}
              onClick={() => onToggleSort("name")}
            >
              Cliente{sortArrow(sortKey === "name", sortDir)}
            </span>
            {showFirstPurchase && (
              <span
                className={`cursor-pointer select-none ${sortKey === "first" ? "text-navy" : ""}`}
                onClick={() => onToggleSort("first")}
              >
                Primera compra{sortArrow(sortKey === "first", sortDir)}
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
            <div className="py-6 text-center text-faint text-sm">Sin resultados</div>
          ) : (
            rows.map(({ customer, byMonth, totalPaid, firstPurchase }) => (
              <div
                key={customer.id}
                onClick={() => onRowClick(customer)}
                className={`${tableRowClassV2} cursor-pointer`}
                style={gridColsV2(cols)}
              >
                <p className="font-semibold text-navy truncate text-[13.5px]" title={customer.name ?? customer.email ?? undefined}>
                  {customer.name ?? customer.email ?? "-"}
                </p>
                {showFirstPurchase && (
                  <p className="text-center text-muted text-[12.5px] whitespace-nowrap">
                    {firstPurchase ? monthLabel(firstPurchase.slice(0, 7)) : "-"}
                  </p>
                )}
                {visibleMonths.map((m) => {
                  const purchases = byMonth[m];
                  if (!purchases || purchases.length === 0) {
                    return <div key={m} />;
                  }
                  const products = [...new Map(purchases.map((p) => [p.product, p])).keys()];
                  const total = purchases.reduce((s, p) => s + p.amount, 0);
                  const colorCls = productColor(products[0]);
                  return (
                    <div key={m} className="flex justify-center">
                      <div className={`rounded-[8px] px-1.5 py-1 flex flex-col items-center gap-0.5 ${colorCls} min-w-[64px]`}>
                        {products.map((prod) => (
                          <span key={prod} className="text-[10px] font-semibold leading-tight">
                            {productAbbr(prod)}
                          </span>
                        ))}
                        <span className="text-[9px] opacity-60 leading-tight font-medium">{fmt(total)}</span>
                      </div>
                    </div>
                  );
                })}
                <p className="text-right font-semibold text-navy text-[13.5px] tabular-nums">{fmt(totalPaid)}</p>
              </div>
            ))
          )}

          {rows.length > 0 && (
            <div className={tableRowClassV2} style={gridColsV2(cols)}>
              <p className="font-semibold text-muted text-[10.5px] uppercase tracking-wide">Total</p>
              {showFirstPurchase && <div />}
              {visibleMonths.map((m) => (
                <p key={m} className="text-center text-[10.5px] font-semibold text-muted tabular-nums">
                  {monthTotals[m] > 0 ? fmt(monthTotals[m]) : "-"}
                </p>
              ))}
              <p className="text-right text-[10.5px] font-bold text-navy tabular-nums">{fmt(grandTotal)}</p>
            </div>
          )}
        </div>
        {rows.length === 0 && <div className={tableFootClassV2} />}
        <TablePaginationV2 page={page} totalItems={totalCount} pageSize={pageSize} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
