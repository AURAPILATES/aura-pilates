"use client";

import { useState, useRef } from "react";
import type { Transaction } from "@/lib/transactions";
import { sortCategoriesHierarchical, categoryDisplayLabel, type Category } from "@/lib/categories";
import DateFilter from "@/app/components/DateFilter";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import FiltersToggleButtonV2 from "@/app/components/v2/FiltersToggleButtonV2";
import ClearFiltersButtonV2 from "@/app/components/v2/ClearFiltersButtonV2";
import { tableHeadClassV2, tableRowClassV2, tableFootClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import {
  MoreOptionsMenu, OriginIcon, originLabel, CategoryPill, CategoryBadge, CategoryMultiFilter,
  fmtAmt, fmtDate, CAT_FALLBACK, MONTHS_ES, type SortKey,
} from "./TransaccionesList";
import { CatIcon } from "./catIcons";
import ImportButton from "./ImportButton";

const COLS = "2.1fr .95fr 1.1fr .7fr .95fr";

/** Barra flotante de acciones masivas, centrada abajo — aparece al seleccionar filas en la
 * tabla de escritorio (checkbox al hover, ver fila de escritorio más abajo). Solo escritorio:
 * las filas de la tabla móvil no tienen checkbox. */
function BulkActionBarV2({
  count, categories, onClear, onSetCategory, onDelete,
}: {
  count: number;
  categories: Category[];
  onClear: () => void;
  onSetCategory: (category: string | null) => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "category" | "delete">("idle");
  const [catDraft, setCatDraft] = useState("");

  function submitCategory() {
    if (!catDraft) return;
    onSetCategory(catDraft === "__null__" ? null : catDraft);
    setMode("idle");
    setCatDraft("");
  }

  return (
    <div className="hidden sm:flex fixed left-1/2 bottom-6 -translate-x-1/2 z-30 items-center gap-2 bg-navy text-app-bg rounded-[14px] shadow-lg pl-4 pr-2 py-2">
      <span className="text-[13px] font-medium whitespace-nowrap">{count} seleccionado{count !== 1 ? "s" : ""}</span>
      <div className="w-px h-5 bg-app-bg/15 shrink-0" />
      {mode === "category" ? (
        <div className="flex items-center gap-1.5">
          <select
            autoFocus
            value={catDraft}
            onChange={(e) => setCatDraft(e.target.value)}
            className="text-[13px] rounded-[7px] px-2 py-1 bg-app-bg/10 text-app-bg border border-app-bg/20 outline-none focus:border-app-bg/40 max-w-[160px] cursor-pointer"
          >
            <option value="" disabled className="text-navy">Categoría…</option>
            <option value="__null__" className="text-navy">Sin categoría</option>
            {sortCategoriesHierarchical(categories).map((c) => (
              <option key={c.value} value={c.value} className="text-navy">{categoryDisplayLabel(c, categories)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={submitCategory}
            disabled={!catDraft}
            className="text-[12px] font-semibold text-navy bg-app-bg hover:bg-app-bg/85 disabled:opacity-40 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap"
          >
            Aplicar
          </button>
          <button type="button" onClick={() => setMode("idle")} className="text-app-bg/50 hover:text-app-bg text-[12px] px-1">
            Cancelar
          </button>
        </div>
      ) : mode === "delete" ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-app-bg/70 whitespace-nowrap">¿Eliminar {count}?</span>
          <button
            type="button"
            onClick={onDelete}
            className="text-[12px] font-semibold text-white bg-[#dc2626] dark:bg-[#dd7e7e] hover:bg-[#dc2626]/85 dark:hover:bg-[#dd7e7e]/85 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap"
          >
            Sí, eliminar
          </button>
          <button type="button" onClick={() => setMode("idle")} className="text-app-bg/50 hover:text-app-bg text-[12px] px-1">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMode("category")} className="text-[12.5px] font-medium text-app-bg/85 hover:text-app-bg hover:bg-app-bg/10 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">
            Editar categoría
          </button>
          <button type="button" onClick={() => setMode("delete")} className="text-[12.5px] font-medium text-[#f87171] hover:text-white hover:bg-[#dc2626]/30 dark:hover:bg-[#dd7e7e]/30 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">
            Eliminar
          </button>
        </div>
      )}
      <button type="button" onClick={onClear} title="Cancelar selección" className="ml-1 w-6 h-6 flex items-center justify-center shrink-0 text-app-bg/40 hover:text-app-bg transition-colors">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

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
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onBulkCategory: (category: string | null) => void;
  onBulkDelete: () => void;
};

/** Versión abreviada para las tarjetas KPI en móvil, donde "100.036,34 €" se corta —
 * p. ej. "63,6k €" en vez de "63.641,05 €". */
function fmtAmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return (abs / 1000).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k €";
  }
  return fmtAmt(abs);
}

function SortArrowV2({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`inline-block ml-1 transition-all ${active ? "opacity-100 text-muted" : "opacity-0 text-border"} ${active && dir === "desc" ? "" : "rotate-180"}`}
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
  selectedIds, onToggleSelect, onToggleSelectAll, onClearSelection, onBulkCategory, onBulkDelete,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const monthRefs = useRef(new Map<string, HTMLDivElement>());
  const pageIds = byMonth.flatMap(([, txns]) => txns.map((t) => t.id));
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const filtersActive = catFilters.length > 0 || onlyRecurring || originFilter !== "all" || amountMin !== "" || amountMax !== "";
  const activeFilterCount =
    (catFilters.length > 0 ? 1 : 0) + (onlyRecurring ? 1 : 0) + (originFilter !== "all" ? 1 : 0) +
    (amountMin !== "" || amountMax !== "" ? 1 : 0) + (directionFilter !== "all" ? 1 : 0);
  function clearFilters() {
    onCatFiltersChange([]);
    if (onlyRecurring) onToggleOnlyRecurring();
    onOriginFilterChange("all");
    onAmountMinChange("");
    onAmountMaxChange("");
    onDirectionFilterChange("all");
  }

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
            directionFilter === "in" ? "border-[#16a34a]/30 dark:border-[#7cdfa0]/30 bg-[#16a34a]/[0.05] dark:bg-[#7cdfa0]/[0.05]" : "border-border bg-card"
          }`}
        >
          <p className="text-[10px] sm:text-[10.5px] tracking-wide uppercase text-faint font-semibold truncate">Entradas</p>
          <p className="text-[15px] sm:text-[22px] font-bold text-[#0d8037] dark:text-[#78e39f] mt-[5px] tracking-tight truncate">
            <span className="sm:hidden">{fmtAmtCompact(totalIn)}</span>
            <span className="hidden sm:inline">{fmtAmt(totalIn)}</span>
          </p>
        </button>
        <button
          type="button"
          onClick={() => onDirectionFilterChange(directionFilter === "out" ? "all" : "out")}
          className={`text-left border rounded-[14px] px-3 sm:px-4 py-[11px] sm:py-[13px] min-w-0 transition-colors ${
            directionFilter === "out" ? "border-[#b53e0d]/30 dark:border-[#e69675]/30 bg-[#b53e0d]/[0.05] dark:bg-[#e69675]/[0.05]" : "border-border bg-card"
          }`}
        >
          <p className="text-[10px] sm:text-[10.5px] tracking-wide uppercase text-faint font-semibold truncate">Salidas</p>
          <p className="text-[15px] sm:text-[22px] font-bold text-[#b53e0d] dark:text-[#e69675] mt-[5px] tracking-tight truncate">
            <span className="sm:hidden">{fmtAmtCompact(totalOut)}</span>
            <span className="hidden sm:inline">{fmtAmt(totalOut)}</span>
          </p>
        </button>
        <div className="border border-border rounded-[14px] px-3 sm:px-4 py-[11px] sm:py-[13px] bg-card min-w-0">
          <p className="text-[10px] sm:text-[10.5px] tracking-wide uppercase text-faint font-semibold truncate">Diferencia</p>
          <div className="flex items-baseline gap-1.5 mt-[5px]">
            <span className={`text-[15px] sm:text-[22px] font-bold tracking-tight truncate ${neto >= 0 ? "text-navy" : "text-[#b53e0d] dark:text-[#e69675]"}`}>
              {neto < 0 && "−"}
              <span className="sm:hidden">{fmtAmtCompact(neto)}</span>
              <span className="hidden sm:inline">{fmtAmt(Math.abs(neto))}</span>
            </span>
            {totalIn > 0 && (
              <span className="hidden sm:inline text-[11.5px] text-faint whitespace-nowrap">margen {(neto / totalIn * 100).toFixed(1).replace(".", ",")}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-[10px] flex-wrap">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar concepto o contacto…" className="flex-1 min-w-[140px]" />
        <FiltersToggleButtonV2 open={filtersOpen} active={filtersActive} onClick={() => setFiltersOpen((v) => !v)} />
        <ImportButton v2 onManual={onAddCash} className="sm:order-2" />
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
          {activeFilterCount >= 2 && (
            <ClearFiltersButtonV2 onClick={clearFilters} className="hidden sm:flex" />
          )}
        </div>
      </div>

      {activeFilterCount >= 2 && (
        <div className="sm:hidden mt-2">
          <ClearFiltersButtonV2 onClick={clearFilters} />
        </div>
      )}

      {uncategorizedCount > 0 && (
        <div className="mt-3">
          <button
            onClick={() => onCatFiltersChange(catFilters.includes("__none__") ? catFilters.filter((v) => v !== "__none__") : [...catFilters, "__none__"])}
            className="inline-flex items-center gap-[7px] bg-[#fef3e2] dark:bg-[#392a13] text-[#b45309] dark:text-[#e8a572] border border-[#f6dcb8] dark:border-[#6f522a] rounded-full px-3 py-[5px] text-[12.5px] font-medium"
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
        <div className="sm:hidden sticky top-[45px] z-20 -mx-2 px-2 pt-3 pb-2 bg-app-bg overflow-x-auto scrollbar-none">
          <div className="inline-flex max-w-full gap-0.5 p-1 rounded-full bg-navy/[0.05]">
            {byMonth.map(([monthKey]) => {
              const [y, m] = monthKey.split("-");
              const label = MONTHS_ES[parseInt(m) - 1].slice(0, 3);
              const showYear = parseInt(y) !== new Date().getFullYear();
              return (
                <button
                  key={monthKey}
                  onClick={() => scrollToMonth(monthKey)}
                  className="shrink-0 px-3.5 py-1.5 rounded-full text-[13px] capitalize whitespace-nowrap text-strong font-medium hover:bg-card hover:shadow-card transition-colors"
                >
                  {label}{showYear && <span className="text-[10px] ml-0.5 opacity-60">{y}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabla suelta agrupada por mes */}
      <div className="mt-2 sm:mt-[24px]">
        <div className="hidden sm:block">
          <div className={`${tableHeadClassV2} px-2`} style={gridColsV2(COLS)}>
            <span className="flex items-center gap-[10px]">
              <span className="w-[30px] h-[30px] shrink-0 flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(el) => { if (el) el.indeterminate = !allPageSelected && somePageSelected; }}
                  onChange={() => onToggleSelectAll(pageIds)}
                  className="w-[13px] h-[13px] rounded-[4px] border-border accent-navy focus:ring-navy/20 cursor-pointer"
                />
              </span>
              <span
                className={`flex items-center cursor-pointer select-none ${sortKey === "concept" ? "text-navy" : ""}`}
                onClick={() => onToggleSort("concept")}
              >
                Concepto<SortArrowV2 active={sortKey === "concept"} dir={sortDir} />
              </span>
            </span>
            <span>Origen</span>
            <span>Categoría</span>
            <span
              className={`flex items-center cursor-pointer select-none ${sortKey === "date" ? "text-navy" : ""}`}
              onClick={() => onToggleSort("date")}
            >
              Fecha<SortArrowV2 active={sortKey === "date"} dir={sortDir} />
            </span>
            <span
              className={`flex items-center justify-end cursor-pointer select-none ${sortKey === "amount" ? "text-navy" : ""}`}
              onClick={() => onToggleSort("amount")}
            >
              Importe / Saldo<SortArrowV2 active={sortKey === "amount"} dir={sortDir} />
            </span>
          </div>
        </div>

        {byMonth.length === 0 ? (
          <div className="py-12 text-center text-faint text-sm">Sin resultados</div>
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
                <div className="flex items-baseline justify-between px-2 py-2 bg-navy/[0.025] border-y border-border">
                  <span className="text-[12.5px] font-semibold text-muted uppercase tracking-wide">{label}</span>
                  <span className={`text-[13px] font-semibold tabular-nums ${monthNet < 0 ? "text-[#b53e0d] dark:text-[#e69675]" : "text-[#16a34a] dark:text-[#7cdfa0]"}`}>
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
                  const isSelected = selectedIds.has(t.id);
                  return (
                    <div key={t.id}>
                      {/* Fila escritorio */}
                      <div className="hidden sm:block">
                        <div
                          className={`${tableRowClassV2} px-2 cursor-pointer group ${isSelected ? "bg-subtle" : ""}`}
                          style={gridColsV2(COLS)}
                          onClick={() => onRowClick(t.id)}
                        >
                          <div className="flex items-center gap-[10px] min-w-0">
                            <span className="relative shrink-0 w-[30px] h-[30px]">
                              <span
                                className={`w-[30px] h-[30px] rounded-[8px] items-center justify-center ${isSelected ? "hidden" : "flex group-hover:hidden"}`}
                                style={{ backgroundColor: accent }}
                              >
                                <CatIcon iconKey={iconKey} name={cat?.label ?? primary} color="#fff" size={14} />
                              </span>
                              <label
                                onClick={(e) => e.stopPropagation()}
                                className={`${isSelected ? "flex" : "hidden group-hover:flex"} items-center justify-center w-[30px] h-[30px] rounded-[8px] border border-border bg-card cursor-pointer`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => onToggleSelect(t.id)}
                                  className="w-[15px] h-[15px] rounded-[4px] border-border accent-navy focus:ring-navy/20 cursor-pointer"
                                />
                              </label>
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-[13.5px] font-semibold text-navy truncate">{primary}</p>
                                {recurringPeriod && (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-navy/35">
                                    <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
                                  </svg>
                                )}
                              </div>
                              {secondary && <p className="text-[11px] text-faint truncate">{secondary}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px] text-muted min-w-0">
                            <OriginIcon method={t.payment_method} />
                            <span className="truncate">{originLabel(t.payment_method)}</span>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <CategoryPill category={t.category} categories={categories} onChange={(cat) => onCategoryChange(t.id, cat)} />
                          </div>
                          <div className="text-[12.5px] text-muted whitespace-nowrap">{fmtDate(t.date)}</div>
                          <div className="text-right">
                            <p className={`text-[13.5px] font-semibold ${t.amount > 0 ? "text-[#16a34a] dark:text-[#7cdfa0]" : "text-navy"}`}>
                              {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                            </p>
                            {t.balance != null && <p className="text-[11px] text-faint">{fmtAmt(t.balance)}</p>}
                          </div>
                        </div>
                      </div>

                      {/* Fila móvil */}
                      <div
                        className="sm:hidden flex items-start gap-[10px] px-2 py-[10px] border-t border-subtle cursor-pointer active:bg-subtle"
                        onClick={() => onRowClick(t.id)}
                      >
                        <span className="w-[32px] h-[32px] shrink-0 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: accent }}>
                          <CatIcon iconKey={iconKey} name={cat?.label ?? primary} color="#fff" size={15} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-[14px] font-semibold text-navy truncate">{primary}</p>
                            {recurringPeriod && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-navy/35">
                                <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
                              </svg>
                            )}
                          </div>
                          {secondary && <p className="text-[12px] text-muted truncate mt-0.5">{secondary}</p>}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <CategoryBadge category={t.category} categories={categories} hideIcon />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-[14px] font-semibold ${t.amount > 0 ? "text-[#16a34a] dark:text-[#7cdfa0]" : "text-navy"}`}>
                            {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                          </p>
                          <p className="text-[11px] text-faint whitespace-nowrap mt-0.5">{fmtDate(t.date)}</p>
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
          <div className="hidden sm:block">
            <TablePaginationV2 page={page} totalItems={totalItems} pageSize={pageSize} onPageChange={onPageChange} />
          </div>
        )}
        {byMonth.length === 0 && <div className={tableFootClassV2} />}
      </div>

      {selectedIds.size > 0 && (
        <BulkActionBarV2
          count={selectedIds.size}
          categories={categories}
          onClear={onClearSelection}
          onSetCategory={onBulkCategory}
          onDelete={onBulkDelete}
        />
      )}
    </div>
  );
}
