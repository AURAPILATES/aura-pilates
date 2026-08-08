"use client";

import { useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RotateCcw } from "react-feather";
import type { Transaction } from "@/lib/transactions";
import { sortCategoriesHierarchical, categoryDisplayLabel, type Category } from "@/lib/categories";
import DateFilter from "@/app/components/DateFilter";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import FiltersToggleButtonV2 from "@/app/components/v2/FiltersToggleButtonV2";
import ClearFiltersButtonV2 from "@/app/components/v2/ClearFiltersButtonV2";
import { tableHeadClassV2, tableRowClassV2, tableFootClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import {
  MoreOptionsMenu, MoreActionsMenu, OriginIcon, originLabel, CategoryPill, CategoryBadge, CategoryMultiFilter,
  fmtAmt, fmtDate, CAT_FALLBACK, MONTHS_ES, type SortKey,
} from "./TransaccionesList";
import { CatIcon } from "./catIcons";
import ImportButton from "./ImportButton";
import HeaderPortal from "@/app/components/HeaderPortal";

const COLS = "1.85fr 1fr 1.5fr .8fr .7fr .95fr";

/** Barra flotante de acciones masivas, centrada abajo - aparece al seleccionar filas en la
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
    <div className="flex fixed z-30 items-center justify-between gap-2 bg-navy text-app-bg shadow-lg pl-4 pr-2 py-2 left-1/2 -translate-x-1/2 bottom-[6px] w-[94%] rounded-[6px] sm:bottom-6 sm:w-auto sm:rounded-[14px]">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-medium whitespace-nowrap">{count} sel.<span className="hidden sm:inline">eccionado{count !== 1 ? "s" : ""}</span></span>
        <div className="w-px h-5 bg-app-bg/15 shrink-0" />
        {mode === "category" ? (
          <div className="flex items-center gap-1.5">
            <select
              autoFocus
              value={catDraft}
              onChange={(e) => setCatDraft(e.target.value)}
              className="text-[13px] rounded-[7px] px-2 py-1 bg-app-bg/10 text-app-bg border border-app-bg/20 outline-none focus:border-app-bg/40 max-w-[130px] sm:max-w-[160px] cursor-pointer"
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
              <span className="sm:hidden">Categoría</span><span className="hidden sm:inline">Editar categoría</span>
            </button>
            <button type="button" onClick={() => setMode("delete")} className="text-[12.5px] font-medium text-[#f87171] hover:text-white hover:bg-[#dc2626]/30 dark:hover:bg-[#dd7e7e]/30 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">
              Eliminar
            </button>
          </div>
        )}
      </div>
      <button type="button" onClick={onClear} title="Cancelar selección" className="w-6 h-6 flex items-center justify-center shrink-0 text-app-bg/40 hover:text-app-bg transition-colors">
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
  onlyNoContact: boolean;
  onToggleOnlyNoContact: () => void;
  directionFilter: "all" | "in" | "out";
  onDirectionFilterChange: (v: "all" | "in" | "out") => void;
  amountMin: string;
  onAmountMinChange: (v: string) => void;
  amountMax: string;
  onAmountMaxChange: (v: string) => void;
  totalIn: number;
  totalOut: number;
  countIn: number;
  countOut: number;
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

/** Versión abreviada para las tarjetas KPI en móvil, donde "100.036,34 €" se corta -
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
  onlyNoContact, onToggleOnlyNoContact,
  directionFilter, onDirectionFilterChange,
  amountMin, onAmountMinChange, amountMax, onAmountMaxChange,
  totalIn, totalOut, countIn, countOut, neto,
  sortKey, sortDir, onToggleSort, byMonth, onRowClick,
  onExportCsv, onAddCash, onPapelera, page, totalItems, pageSize, onPageChange, recurringPeriods,
  onCategoryChange,
  selectedIds, onToggleSelect, onToggleSelectAll, onClearSelection, onBulkCategory, onBulkDelete,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Modo selección solo para móvil: en escritorio se selecciona con el checkbox al hover,
  // pero en móvil no hay hover, así que se activa un modo en el que tocar una fila la marca
  // en vez de abrir su detalle.
  const [selectionMode, setSelectionMode] = useState(false);
  const monthRefs = useRef(new Map<string, HTMLDivElement>());
  const pageIds = byMonth.flatMap(([, txns]) => txns.map((t) => t.id));
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // El rango de fechas vive en la URL (range/from/to), no en el estado de React.
  const dateActive = (searchParams.get("range") ?? "all") !== "all" || !!searchParams.get("from") || !!searchParams.get("to");

  const filtersActive = catFilters.length > 0 || onlyRecurring || onlyNoContact || originFilter !== "all" || amountMin !== "" || amountMax !== "" || dateActive;
  const activeFilterCount =
    (catFilters.length > 0 ? 1 : 0) + (onlyRecurring ? 1 : 0) + (onlyNoContact ? 1 : 0) + (originFilter !== "all" ? 1 : 0) +
    (amountMin !== "" || amountMax !== "" ? 1 : 0) + (directionFilter !== "all" ? 1 : 0) + (search.trim() ? 1 : 0) + (dateActive ? 1 : 0);
  const totalCount = countIn + countOut;
  const pctIn = totalCount > 0 ? (countIn / totalCount * 100).toFixed(1).replace(".", ",") : "0";
  const pctOut = totalCount > 0 ? (countOut / totalCount * 100).toFixed(1).replace(".", ",") : "0";

  function clearFilters() {
    onCatFiltersChange([]);
    if (onlyRecurring) onToggleOnlyRecurring();
    if (onlyNoContact) onToggleOnlyNoContact();
    onOriginFilterChange("all");
    onAmountMinChange("");
    onAmountMaxChange("");
    onDirectionFilterChange("all");
    onSearchChange("");
    // Filtros que viven en la URL: rango de fechas + deep-links (categoría/origen/búsqueda).
    const params = new URLSearchParams(searchParams.toString());
    for (const k of ["range", "from", "to", "categoria", "origen", "buscar"]) params.delete(k);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function scrollToMonth(key: string) {
    monthRefs.current.get(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    onClearSelection();
  }

  return (
    <div className="mb-8">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3 mb-[18px]">
        <button
          type="button"
          onClick={() => onDirectionFilterChange(directionFilter === "in" ? "all" : "in")}
          className={`text-left border rounded-[14px] px-3 sm:px-4 py-[11px] sm:py-[13px] min-w-0 transition-colors ${
            directionFilter === "in" ? "border-[#16a34a]/30 dark:border-[#7cdfa0]/30 bg-[#16a34a]/[0.05] dark:bg-[#7cdfa0]/[0.05]" : "border-border bg-card"
          }`}
        >
          <p className="flex items-center gap-1.5 text-[10px] sm:text-[10.5px] tracking-wide uppercase text-faint font-semibold truncate">
            <span className="shrink-0 w-[7px] h-[7px] rounded-full bg-[#0d8037] dark:bg-[#78e39f]" />
            Entradas
          </p>
          <p className="text-[15px] sm:text-[22px] font-bold text-[#0d8037] dark:text-[#78e39f] mt-[5px] tracking-tight truncate">
            <span className="sm:hidden">{fmtAmtCompact(totalIn)}</span>
            <span className="hidden sm:inline">{fmtAmt(totalIn)}</span>
          </p>
          <p className="hidden sm:block text-[11.5px] text-faint mt-0.5 truncate">
            {countIn} movimiento{countIn !== 1 ? "s" : ""} · {pctIn}%
          </p>
        </button>
        <button
          type="button"
          onClick={() => onDirectionFilterChange(directionFilter === "out" ? "all" : "out")}
          className={`text-left border rounded-[14px] px-3 sm:px-4 py-[11px] sm:py-[13px] min-w-0 transition-colors ${
            directionFilter === "out" ? "border-[#b53e0d]/30 dark:border-[#e69675]/30 bg-[#b53e0d]/[0.05] dark:bg-[#e69675]/[0.05]" : "border-border bg-card"
          }`}
        >
          <p className="flex items-center gap-1.5 text-[10px] sm:text-[10.5px] tracking-wide uppercase text-faint font-semibold truncate">
            <span className="shrink-0 w-[7px] h-[7px] rounded-full bg-[#b53e0d] dark:bg-[#e69675]" />
            Salidas
          </p>
          <p className="text-[15px] sm:text-[22px] font-bold text-[#b53e0d] dark:text-[#e69675] mt-[5px] tracking-tight truncate">
            <span className="sm:hidden">{fmtAmtCompact(totalOut)}</span>
            <span className="hidden sm:inline">{fmtAmt(totalOut)}</span>
          </p>
          <p className="hidden sm:block text-[11.5px] text-faint mt-0.5 truncate">
            {countOut} movimiento{countOut !== 1 ? "s" : ""} · {pctOut}%
          </p>
        </button>
        <div className="border border-border rounded-[14px] px-3 sm:px-4 py-[11px] sm:py-[13px] bg-card min-w-0">
          <p className="text-[10px] sm:text-[10.5px] tracking-wide uppercase text-faint font-semibold truncate">Diferencia</p>
          <div className="flex items-baseline gap-1.5 mt-[5px] flex-wrap">
            <span className={`text-[15px] sm:text-[22px] font-bold tracking-tight truncate ${neto >= 0 ? "text-navy" : "text-[#b53e0d] dark:text-[#e69675]"}`}>
              {neto < 0 && "−"}
              <span className="sm:hidden">{fmtAmtCompact(neto)}</span>
              <span className="hidden sm:inline">{fmtAmt(Math.abs(neto))}</span>
            </span>
            {totalIn > 0 && (
              <span className="hidden sm:inline text-[11px] font-medium text-[#0d8037] dark:text-[#78e39f] bg-[#0d8037]/10 dark:bg-[#78e39f]/10 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                margen {(neto / totalIn * 100).toFixed(1).replace(".", ",")}%
              </span>
            )}
          </div>
          <p className="hidden sm:block text-[11.5px] text-faint mt-0.5 truncate">
            {totalCount} movimiento{totalCount !== 1 ? "s" : ""} en total
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar concepto o contacto…" className="flex-1 min-w-[140px]" />
        {byMonth.length > 0 && (
          <button
            type="button"
            onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
            title={selectionMode ? "Cancelar selección" : "Seleccionar varios"}
            className={`sm:hidden shrink-0 flex items-center justify-center w-9 h-9 rounded-[10px] border transition-colors ${
              selectionMode ? "border-navy bg-navy text-app-bg" : "border-border bg-card text-muted"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </button>
        )}
        <FiltersToggleButtonV2 open={filtersOpen} active={filtersActive} onClick={() => setFiltersOpen((v) => !v)} />
        <HeaderPortal>
          <div className="hidden sm:block">
            <DateFilter variant="v2" />
          </div>
          <ImportButton v2 onManual={onAddCash} />
        </HeaderPortal>
        <div className={`${filtersOpen ? "flex" : "hidden"} sm:flex sm:order-1 items-center gap-[10px] flex-wrap w-full sm:w-auto`}>
          <div className="sm:hidden">
            <DateFilter variant="v2" />
          </div>
          <CategoryMultiFilter selected={catFilters} categories={categories} onChange={onCatFiltersChange} />
          <MoreOptionsMenu
            onlyRecurring={onlyRecurring}
            setOnlyRecurring={onToggleOnlyRecurring}
            onlyNoContact={onlyNoContact}
            setOnlyNoContact={onToggleOnlyNoContact}
            originFilter={originFilter}
            setOriginFilter={onOriginFilterChange}
            amountMin={amountMin}
            setAmountMin={onAmountMinChange}
            amountMax={amountMax}
            setAmountMax={onAmountMaxChange}
          />
          <MoreActionsMenu onExport={onExportCsv} onPapelera={onPapelera} />
          {uncategorizedCount > 0 && (
            <button
              onClick={() => onCatFiltersChange(catFilters.includes("__none__") ? catFilters.filter((v) => v !== "__none__") : [...catFilters, "__none__"])}
              className="shrink-0 h-9 inline-flex items-center gap-[7px] bg-[#fef3e2] dark:bg-[#392a13] text-[#b45309] dark:text-[#e8a572] border border-dashed border-[#f6dcb8] dark:border-[#6f522a] rounded-[10px] px-3 text-[12.5px] font-medium whitespace-nowrap"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17v.5" />
              </svg>
              {uncategorizedCount} sin etiquetar
            </button>
          )}
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

      {/* Móvil: franja de meses (sticky), navega a cada grupo del mes */}
      {byMonth.length > 0 && (
        <div className="sm:hidden sticky top-[45px] z-20 -mx-2 px-2 pt-3 pb-2 bg-app-bg overflow-x-auto scrollbar-none">
          <div className="inline-flex w-max gap-0.5 p-1 rounded-full bg-navy/[0.05]">
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

      {/* Tabla agrupada por mes, en tarjeta blanca - a sangre lateral: la cabecera y las
          bandas de mes llegan al borde real de la tarjeta (fondo incluido), el contenido
          se inserta con 20px fijos independientes del padding lateral de la página. */}
      <div className={`mt-2 sm:mt-[24px] -mx-2 sm:-mx-6 ${tableCardClassV2} overflow-hidden`}>
        <div className="hidden sm:block">
          <div className={`${tableHeadClassV2} px-5`} style={gridColsV2(COLS)}>
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
            <span>Contacto</span>
            <span>Categoría</span>
            <span>Origen</span>
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
          <div className="py-12 px-5 text-center text-faint text-sm">Sin resultados</div>
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
                <div className="table-band flex items-baseline justify-between py-2 px-5 bg-navy/[0.025] border-y border-border">
                  <span className="text-[12.5px] font-semibold text-muted uppercase tracking-wide">{label}</span>
                  <span className={`text-[13px] font-semibold tabular-nums ${monthNet < 0 ? "text-[#b53e0d] dark:text-[#e69675]" : "text-[#13803a] dark:text-[#7cdfa0]"}`}>
                    {monthNet < 0 ? "−" : "+"}{fmtAmt(Math.abs(monthNet))}
                  </span>
                </div>
                {monthTxns.map((t) => {
                  const recurringPeriod = recurringPeriods[t.id];
                  const concept = t.concept || "—";
                  // Escritorio: "más datos" (bank_details) va gris bajo el concepto; el contacto tiene columna propia.
                  // Móvil (sin columnas): el contacto va gris como subtítulo bajo el concepto.
                  const mobileContact = t.contact && t.contact !== t.concept ? t.contact : null;
                  const cat = t.category ? categories.find((c) => c.value === t.category) : undefined;
                  const accent = cat ? cat.text_color : CAT_FALLBACK.color;
                  const iconKey = cat ? cat.emoji : CAT_FALLBACK.emoji;
                  const isSelected = selectedIds.has(t.id);
                  return (
                    <div key={t.id}>
                      {/* Fila escritorio */}
                      <div className="hidden sm:block">
                        <div
                          className={`${tableRowClassV2} px-5 cursor-pointer group ${isSelected ? "bg-subtle" : ""}`}
                          style={gridColsV2(COLS)}
                          onClick={() => onRowClick(t.id)}
                        >
                          <div className="flex items-center gap-[10px] min-w-0">
                            <span className="relative shrink-0 w-[30px] h-[30px]">
                              <span
                                className={`w-[30px] h-[30px] rounded-[8px] items-center justify-center ${isSelected ? "hidden" : "flex group-hover:hidden"}`}
                                style={{ backgroundColor: accent }}
                              >
                                <CatIcon iconKey={iconKey} name={cat?.label ?? concept} color="#fff" size={14} />
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
                                <p className="text-[13.5px] font-medium text-navy truncate">{concept}</p>
                                {recurringPeriod && (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-navy/35">
                                    <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
                                  </svg>
                                )}
                                {t.is_refund && (
                                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                    <RotateCcw size={9} className="shrink-0" />
                                    Devolución
                                  </span>
                                )}
                              </div>
                              {t.bank_details && <p className="text-[11px] text-faint truncate">{t.bank_details}</p>}
                            </div>
                          </div>
                          <div className="text-[12.5px] text-muted truncate min-w-0">
                            {t.contact || <span className="text-faint">—</span>}
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <CategoryPill category={t.category} categories={categories} onChange={(cat) => onCategoryChange(t.id, cat)} />
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px] text-muted min-w-0">
                            <OriginIcon method={t.payment_method} />
                            <span className="truncate">{originLabel(t.payment_method)}</span>
                          </div>
                          <div className="text-[12.5px] text-muted whitespace-nowrap">{fmtDate(t.date)}</div>
                          <div className="text-right">
                            <p className={`text-[13.5px] font-semibold ${t.amount > 0 ? "text-[#13803a] dark:text-[#7cdfa0]" : "text-navy"}`}>
                              {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                            </p>
                            {t.balance != null && <p className="text-[11px] text-faint">{fmtAmt(t.balance)}</p>}
                          </div>
                        </div>
                      </div>

                      {/* Fila móvil */}
                      <div
                        className={`sm:hidden flex items-start gap-[10px] py-[10px] px-5 border-t border-subtle cursor-pointer active:bg-subtle ${isSelected ? "bg-subtle" : ""}`}
                        onClick={() => (selectionMode ? onToggleSelect(t.id) : onRowClick(t.id))}
                      >
                        {selectionMode ? (
                          <span className="w-[32px] h-[32px] shrink-0 rounded-[10px] flex items-center justify-center border border-border bg-card">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              className="w-[16px] h-[16px] rounded-[4px] border-border accent-navy pointer-events-none"
                            />
                          </span>
                        ) : (
                          <span className="w-[32px] h-[32px] shrink-0 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: accent }}>
                            <CatIcon iconKey={iconKey} name={cat?.label ?? concept} color="#fff" size={15} />
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-[14px] font-medium text-navy truncate">{concept}</p>
                            {recurringPeriod && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-navy/35">
                                <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
                              </svg>
                            )}
                          </div>
                          {mobileContact && <p className="text-[12px] text-muted truncate mt-0.5">{mobileContact}</p>}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {t.is_refund && (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                <RotateCcw size={9} className="shrink-0" />
                                Devolución
                              </span>
                            )}
                            <CategoryBadge category={t.category} categories={categories} hideIcon />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-[14px] font-semibold ${t.amount > 0 ? "text-[#13803a] dark:text-[#7cdfa0]" : "text-navy"}`}>
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
          onClear={exitSelectionMode}
          onSetCategory={onBulkCategory}
          onDelete={onBulkDelete}
        />
      )}
    </div>
  );
}
