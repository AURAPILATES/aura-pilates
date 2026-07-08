import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import DateFilter from "@/app/components/DateFilter";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import { PrimaryButtonV2 } from "@/app/components/v2/ButtonsV2";
import { tableHeadClassV2, tableRowClassV2, tableGroupClassV2, tableFootClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import {
  MoreOptionsMenu, Checkbox, OriginIcon, originLabel, CategoryPill, CategoryMultiFilter,
  fmtAmt, fmtDate, CAT_FALLBACK, MONTHS_ES, type SortKey,
} from "./TransaccionesList";
import { CatIcon } from "./catIcons";

const COLS = "20px 1.9fr .95fr 1.1fr .7fr .95fr";

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
  totalIn: number;
  totalOut: number;
  neto: number;
  someSelected: boolean;
  sortKey: SortKey | null;
  sortDir: "asc" | "desc";
  onToggleSort: (k: SortKey) => void;
  byMonth: [string, Transaction[]][];
  selected: Set<string>;
  onToggleOne: (id: string) => void;
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
  directionFilter, onDirectionFilterChange, totalIn, totalOut, neto, someSelected,
  sortKey, sortDir, onToggleSort, byMonth, selected, onToggleOne, onRowClick,
  onExportCsv, onAddCash, onPapelera, page, totalItems, pageSize, onPageChange, recurringPeriods,
  onCategoryChange,
}: Props) {
  return (
    <div className="mb-8">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-[18px]">
        <button
          type="button"
          onClick={() => onDirectionFilterChange(directionFilter === "in" ? "all" : "in")}
          className={`text-left border rounded-[14px] px-4 py-[13px] transition-colors ${
            directionFilter === "in" ? "border-[#16a34a]/30 bg-[#16a34a]/[0.05]" : "border-[#ececef] bg-white"
          }`}
        >
          <p className="text-[10.5px] tracking-wide uppercase text-[#a1a1aa] font-semibold">Entradas</p>
          <p className="text-[22px] font-bold text-[#0d8037] mt-[5px] tracking-tight">{fmtAmt(totalIn)}</p>
        </button>
        <button
          type="button"
          onClick={() => onDirectionFilterChange(directionFilter === "out" ? "all" : "out")}
          className={`text-left border rounded-[14px] px-4 py-[13px] transition-colors ${
            directionFilter === "out" ? "border-[#b53e0d]/30 bg-[#b53e0d]/[0.05]" : "border-[#ececef] bg-white"
          }`}
        >
          <p className="text-[10.5px] tracking-wide uppercase text-[#a1a1aa] font-semibold">Salidas</p>
          <p className="text-[22px] font-bold text-[#b53e0d] mt-[5px] tracking-tight">{fmtAmt(totalOut)}</p>
        </button>
        <div className="border border-[#ececef] rounded-[14px] px-4 py-[13px] bg-white">
          <p className="text-[10.5px] tracking-wide uppercase text-[#a1a1aa] font-semibold">
            {someSelected ? "Neto selección" : "Diferencia"}
          </p>
          <div className="flex items-baseline gap-1.5 mt-[5px]">
            <span className={`text-[22px] font-bold tracking-tight ${neto >= 0 ? "text-[#18181b]" : "text-[#b53e0d]"}`}>
              {neto < 0 && "−"}{fmtAmt(Math.abs(neto))}
            </span>
            {!someSelected && totalIn > 0 && (
              <span className="text-[11.5px] text-[#a1a1aa]">margen {(neto / totalIn * 100).toFixed(1).replace(".", ",")}%</span>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-[10px]">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar concepto o contacto…" className="flex-1" />
        <DateFilter variant="v2" />
        <CategoryMultiFilter selected={catFilters} categories={categories} onChange={onCatFiltersChange} />
        <MoreOptionsMenu
          onlyRecurring={onlyRecurring}
          setOnlyRecurring={onToggleOnlyRecurring}
          originFilter={originFilter}
          setOriginFilter={onOriginFilterChange}
          onExport={onExportCsv}
          onPapelera={onPapelera}
        />
        <PrimaryButtonV2 onClick={onAddCash} className="flex items-center gap-[7px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Añadir movimiento
        </PrimaryButtonV2>
      </div>

      {uncategorizedCount > 0 && !someSelected && (
        <div className="mt-3">
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

      {/* Tabla suelta agrupada por mes */}
      <div className="mt-[24px]">
        <div className={tableHeadClassV2} style={gridColsV2(COLS)}>
          <span />
          <span
            className="flex items-center cursor-pointer select-none"
            onClick={() => onToggleSort("concept")}
          >
            Concepto<SortArrowV2 active={sortKey === "concept"} dir={sortDir} />
          </span>
          <span>Origen</span>
          <span>Categoría</span>
          <span className="flex items-center cursor-pointer select-none" onClick={() => onToggleSort("date")}>
            Fecha<SortArrowV2 active={sortKey === "date"} dir={sortDir} />
          </span>
          <span className="flex items-center justify-end cursor-pointer select-none" onClick={() => onToggleSort("amount")}>
            Importe / Saldo<SortArrowV2 active={sortKey === "amount"} dir={sortDir} />
          </span>
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
              <div key={monthKey}>
                <div className={tableGroupClassV2}>
                  <span>{label}</span>
                  <span className={monthNet < 0 ? "text-[#b53e0d]" : "text-[#16a34a]"}>
                    {monthNet < 0 ? "−" : "+"}{fmtAmt(Math.abs(monthNet))}
                  </span>
                </div>
                {monthTxns.map((t) => {
                  const recurringPeriod = recurringPeriods[t.id];
                  const isSelected = selected.has(t.id);
                  const primary = t.contact || t.concept || "—";
                  const secondary = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;
                  const cat = t.category ? categories.find((c) => c.value === t.category) : undefined;
                  const accent = cat ? cat.text_color : CAT_FALLBACK.color;
                  const iconKey = cat ? cat.emoji : CAT_FALLBACK.emoji;
                  return (
                    <div
                      key={t.id}
                      className={`${tableRowClassV2} cursor-pointer ${isSelected ? "bg-[#18181b]/[0.03]" : ""}`}
                      style={gridColsV2(COLS)}
                      onClick={() => onRowClick(t.id)}
                    >
                      <span onClick={(e) => { e.stopPropagation(); onToggleOne(t.id); }}>
                        <Checkbox checked={isSelected} onChange={() => onToggleOne(t.id)} />
                      </span>
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
