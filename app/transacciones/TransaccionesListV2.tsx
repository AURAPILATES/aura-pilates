"use client";

import { useState, useRef } from "react";
import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import DateFilter from "@/app/components/DateFilter";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import FiltersToggleButtonV2 from "@/app/components/v2/FiltersToggleButtonV2";
import { tableHeadClassV2, tableRowClassV2, tableFootClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import {
  MoreOptionsMenu, OriginIcon, originLabel, CategoryPill, CategoryMultiFilter,
  fmtAmt, fmtDate, CAT_FALLBACK, MONTHS_ES, type SortKey,
} from "./TransaccionesList";
import { CatIcon } from "./catIcons";
import ImportButton from "./ImportButton";

const COLS = "2.1fr .95fr 1.1fr .7fr .95fr";

type Props = {
  categories: Category[];
  uncategorizedCount: number;
  search: string;
  onSearchChange: (v: string) => void;
  catFilters: string[];
  onCatFiltersChange: (v: string[]) => void;
  originFilter: string;
  onOriginFilterChange: (v: string) => void;
  onlyRecurring: boolean;
  onToggleOnlyRecurring: () => void;
  directionFilter: "all" | "in" | "out";
  onDirectionFilterChange: (v: "all" | "in" | "out") => void;
  amountMin: string;
  onAmountMinChange: (v: string) => void;
  amountMax: string;
  onAmountMaxChange: (v: string) => void;
  totalIn: number;
  totalOut: number;
  neto: number;
  sortKey: SortKey | null;
  sortDir: "asc" | "desc";
  onToggleSort: (k: SortKey) => void;
  byMonth: [string, Transaction[]][];
  onRowClick: (id: string) => void;
  onExportCsv: () => void;
  onAddCash: () => void;
  onPapelera: () => void;
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  recurringPeriods: Record<string, string>;
  onCategoryChange: (id: string, category: string | null) => void;
};

function SortArrowV2({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`inline-block ml-1 transition-all ${active ? "opacity-100 text-[#52525b]" : "opacity-0 text-[#cfcfd4]"} ${active && dir === "desc" ? "" : "rotate-180"}`}
    >
      <path d="M6 10l6 6 6-6" />
    </svg>
  );
}

export default function TransaccionesListV2({
  categories, uncategorizedCount, search, onSearchChange, catFilters, onCatFiltersChange,
  originFilter, onOriginFilterChange, onlyRecurring, onToggleOnlyRecurring,
  directionFilter, onDirectionFilterChange,
  amountMin, onAmountMinChange, amountMax, onAmountMaxChange,
  totalIn, totalOut, neto,
  sortKey, sortDir, onToggleSort, byMonth, onRowClick,
  onExportCsv, onAddCash, onPapelera, page, totalItems, pageSize, onPageChange, recurringPeriods,
  onCategoryChange,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const monthRefs = useRef(new Map<string, HTMLDivElement>());
  const filtersActive = catFilters.length > 0 || onlyRecurring || originFilter !== "all" || amountMin !== "" || amountMax !== "";

  function scrollToMonth(key: string) {
    monthRefs.current.get(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="mb-8">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-[18px]">
        <button
          type="button"
          onClick={() => onDirectionFilterChange(directionFilter === "in" ? "all" : "in")}
          className={`text-left border rounded-[14px] px-3 sm:px-4 py-[11px] sm:py-[13px] min-w-0 transition-colors ${
            directionFilter === "in" ? "border-[#16a34a]/30 bg-[#16a34a]/[0.05]" : "border-[#ececef] bg-white"
          }`}
        >
          <p className="text-[10px] sm:text-[10.5px] tracking-wide uppercase text-[#a1a1aa] font-semibold truncate">Entradas</p>
          <p className="text-[15px] sm:text-[22px] font-bold text-[#0d8037] mt-[5px] tracking-tight truncate">{fmtAmt(totalIn)}</p>
        </button>
        <button
          type="button"
          onClick={() => onDirectionFilterChange(directionFilter === "out" ? "all" : "out")}
          className={`text-left border rounded-[14px] px-3 sm:px-4 py-[11px] sm:py-[13px] min-w-0 transition-colors ${
            directionFilter === "out" ? "border-[#b53e0d]/30 bg-[#b53e0d]/[0.05]" : "border-[#ececef] bg-white"
          }`}
        >
          <p className="text-[10px] sm:text-[10.5px] tracking-wide uppercase text-[#a1a1aa] font-semibold truncate">Salidas</p>
          <p className="text-[15px] sm:text-[22px] font-bold text-[#b53e0d] mt-[5px] tracking-tight truncate">{fmtAmt(totalOut)}</p>
        </button>
        <div className="border border-[#ececef] rounded-[14px] px-3 sm:px-4 py-[11px] sm:py-[13px] bg-white min-w-0">
          <p className="text-[10px] sm:text-[10.5px] tracking-wide uppercase text-[#a1a1aa] font-semibold truncate">Diferencia</p>
          <div className="flex items-baseline gap-1.5 mt-[5px]">
            <span className={`text-[15px] sm:text-[22px] font-bold tracking-tight truncate ${neto >= 0 ? "text-[#18181b]" : "text-[#b53e0d]"}`}>
              {neto < 0 && "−"}{fmtAmt(Math.abs(neto))}
            </span>
            {totalIn > 0 && (
              <span className="hidden sm:inline text-[11.5px] text-[#a1a1aa] whitespace-nowrap">margen {(neto / totalIn * 100).toFixed(1).replace(".", ",")}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-[10px] flex-wrap">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar concepto o contacto…" className="flex-1 min-w-[140px]" />
        <FiltersToggleButtonV2 open={filtersOpen} active={filtersActive} onClick={() => setFiltersOpen((v) => !v)} />
        <ImportButton onManual={onAddCash} className="hidden sm:block sm:order-2" />
        <div className={`${filtersOpen ? "flex" : "hidden"} sm:flex sm:order-1 items-center gap-[10px] flex-wrap w-full sm:w-auto`}>
          <DateFilter variant="v2" />
          <CategoryMultiFilter selected={catFilters} categories={categories} onChange={onCatFiltersChange} />
          <MoreOptionsMenu
            onlyRecurring={onlyRecurring}
            setOnlyRecurring={onToggleOnlyRecurring}
            originFilter={originFilter}
            setOriginFilter={onOriginFilterChange}
            amountMin={amountMin}
            setAmountMin={onAmountMinChange}
            amountMax={amountMax}
            setAmountMax={onAmountMaxChange}
            onExport={onExportCsv}
            onPapelera={onPapelera}
          />
        </div>
      </div>

      {/* Móvil: Añadir movimiento + sin etiquetar, uno al lado del otro */}
      <div className="sm:hidden flex items-stretch gap-[10px] mt-3">
        <ImportButton onManual={onAddCash} className="flex-1" />
        {uncategorizedCount > 0 && (
          <button
            onClick={() => onCatFiltersChange(catFilters.includes("__none__") ? catFilters.filter((v) => v !== "__none__") : [...catFilters, "__none__"])}
            className="flex-1 inline-flex items-center justify-center gap-[7px] bg-[#fef3e2] text-[#b45309] border border-[#f6dcb8] rounded-[8px] px-3 py-2.5 text-[12.5px] font-medium whitespace-nowrap"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17v.5" />
            </svg>
            {uncategorizedCount} sin etiquetar
          </button>
        )}
      </div>

      {uncategorizedCount > 0 && (
        <div className="hidden sm:block mt-3">
          <button
            onClick={() => onCatFiltersChange(catFilters.includes("__none__") ? catFilters.filter((v) => v !== "__none__") : [...catFilters, "__none__"])}
            className="inline-flex items-center gap-[7px] bg-[#fef3e2] text-[#b45309] border border-[#f6dcb8] rounded-full px-3 py-[5px] text-[12.5px] font-medium"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17v.5" />
            </svg>
            {uncategorizedCount} sin etiquetar
          </button>
        </div>
      )}

      {/* Móvil: franja de meses (sticky), navega a cada grupo del mes */}
      {byMonth.length > 0 && (
        <div className="sm:hidden sticky top-[45px] z-20 -mx-2 px-2 pt-3 pb-2 bg-app-bg">
          <div className="flex gap-0.5 p-1 rounded-full bg-[#18181b]/[0.05] overflow-x-auto scrollbar-none">
            {byMonth.map(([monthKey]) => {
              const [y, m] = monthKey.split("-");
              const label = MONTHS_ES[parseInt(m) - 1].slice(0, 3);
              const showYear = parseInt(y) !== new Date().getFullYear();
              return (
                <button
                  key={monthKey}
                  onClick={() => scrollToMonth(monthKey)}
                  className="shrink-0 px-3.5 py-1.5 rounded-full text-[13px] capitalize whitespace-nowrap text-[#3f3f46] font-medium hover:bg-white hover:shadow-card transition-colors"
                >
                  {label}{showYear && <span className="text-[10px] ml-0.5 opacity-60">{y}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabla suelta agrupada por mes */}
      <div className="mt-[24px]">
        <div className="hidden sm:block">
          <div className={`${tableHeadClassV2} px-2`} style={gridColsV2(COLS)}>
            <span
              className={`flex items-center cursor-pointer select-none ${sortKey === "concept" ? "text-[#18181b]" : ""}`}
              onClick={() => onToggleSort("concept")}
            >
              Concepto<SortArrowV2 active={sortKey === "concept"} dir={sortDir} />
            </span>
            <span>Origen</span>
            <span>Categoría</span>
            <span
              className={`flex items-center cursor-pointer select-none ${sortKey === "date" ? "text-[#18181b]" : ""}`}
              onClick={() => onToggleSort("date")}
            >
              Fecha<SortArrowV2 active={sortKey === "date"} dir={sortDir} />
            </span>
            <span
              className={`flex items-center justify-end cursor-pointer select-none ${sortKey === "amount" ? "text-[#18181b]" : ""}`}
              onClick={() => onToggleSort("amount")}
            >
              Importe / Saldo<SortArrowV2 active={sortKey === "amount"} dir={sortDir} />
            </span>
          </div>
        </div>

        {byMonth.length === 0 ? (
          <div className="py-12 text-center text-[#a1a1aa] text-sm">Sin resultados</div>
        ) : (
          byMonth.map(([monthKey, monthTxns]) => {
            const monthNet = monthTxns.reduce((s, t) => s + t.amount, 0);
            const [y, m] = monthKey.split("-");
            const monthName = MONTHS_ES[parseInt(m) - 1];
            const label = monthName.toUpperCase() + (parseInt(y) !== new Date().getFullYear() ? ` ${y}` : "");
            return (
              <div
                key={monthKey}
                ref={(el) => { if (el) monthRefs.current.set(monthKey, el); else monthRefs.current.delete(monthKey); }}
                className="scroll-mt-[104px]"
              >
                <div className="flex items-baseline justify-between px-2 py-2 bg-[#18181b]/[0.025] border-y border-[#ececef]">
                  <span className="text-[12.5px] font-semibold text-[#71717a] uppercase tracking-wide">{label}</span>
                  <span className={`text-[13px] font-semibold tabular-nums ${monthNet < 0 ? "text-[#b53e0d]" : "text-[#16a34a]"}`}>
                    {monthNet < 0 ? "−" : "+"}{fmtAmt(Math.abs(monthNet))}
                  </span>
                </div>
                {monthTxns.map((t) => {
                  const recurringPeriod = recurringPeriods[t.id];
                  const primary = t.contact || t.concept || "—";
                  const secondary = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;
                  const cat = t.category ? categories.find((c) => c.value === t.category) : undefined;
                  const accent = cat ? cat.text_color : CAT_FALLBACK.color;
                  const iconKey = cat ? cat.emoji : CAT_FALLBACK.emoji;
                  return (
                    <div key={t.id}>
                      {/* Fila escritorio */}
                      <div className="hidden sm:block">
                        <div
                          className={`${tableRowClassV2} px-2 cursor-pointer`}
                          style={gridColsV2(COLS)}
                          onClick={() => onRowClick(t.id)}
                        >
                          <div className="flex items-center gap-[10px] min-w-0">
                            <span className="w-[30px] h-[30px] shrink-0 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: accent }}>
                              <CatIcon iconKey={iconKey} name={cat?.label ?? primary} color="#fff" size={14} />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-[13.5px] font-semibold text-[#18181b] truncate">{primary}</p>
                                {recurringPeriod && (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeOpacity=".35" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                    <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
                                  </svg>
                                )}
                              </div>
                              {secondary && <p className="text-[11px] text-[#a1a1aa] truncate">{secondary}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px] text-[#71717a] min-w-0">
                            <OriginIcon method={t.payment_method} />
                            <span className="truncate">{originLabel(t.payment_method)}</span>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <CategoryPill category={t.category} categories={categories} onChange={(cat) => onCategoryChange(t.id, cat)} />
                          </div>
                          <div className="text-[12.5px] text-[#71717a] whitespace-nowrap">{fmtDate(t.date)}</div>
                          <div className="text-right">
                            <p className={`text-[13.5px] font-semibold ${t.amount > 0 ? "text-[#16a34a]" : "text-[#18181b]"}`}>
                              {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                            </p>
                            {t.balance != null && <p className="text-[11px] text-[#a1a1aa]">{fmtAmt(t.balance)}</p>}
                          </div>
                        </div>
                      </div>

                      {/* Fila móvil */}
                      <div
                        className="sm:hidden flex items-center gap-[10px] px-2 py-[10px] border-t border-[#f4f4f4] cursor-pointer active:bg-[#fafafb]"
                        onClick={() => onRowClick(t.id)}
                      >
                        <span className="w-[32px] h-[32px] shrink-0 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: accent }}>
                          <CatIcon iconKey={iconKey} name={cat?.label ?? primary} color="#fff" size={15} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-[14px] font-semibold text-[#18181b] truncate">{primary}</p>
                            {recurringPeriod && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#18181b" strokeOpacity=".35" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                                <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
                              </svg>
                            )}
                          </div>
                          <p className="text-[11.5px] text-[#a1a1aa] truncate mt-0.5">
                            {cat?.label ?? "Sin categoría"} · {fmtDate(t.date)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-[14px] font-semibold ${t.amount > 0 ? "text-[#16a34a]" : "text-[#18181b]"}`}>
                            {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
        {byMonth.length > 0 && (
          <TablePaginationV2 page={page} totalItems={totalItems} pageSize={pageSize} onPageChange={onPageChange} />
        )}
        {byMonth.length === 0 && <div className={tableFootClassV2} />}
      </div>
    </div>
  );
}
