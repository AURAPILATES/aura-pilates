import { useState } from "react";
import Avatar from "@/app/components/Avatar";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import FiltersToggleButtonV2 from "@/app/components/v2/FiltersToggleButtonV2";
import { IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import Select from "@/app/components/Select";
import ClearFiltersButtonV2 from "@/app/components/v2/ClearFiltersButtonV2";
import { tableHeadClassV2, tableRowClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { fmt } from "@/lib/analytics";
import { clientStatus, initials, fmtDate, SESSION_PLAN, type CustomerRow, type Filter, type SortKey, type SortDir } from "./ClientesTable";
import { productAbbr, productColor, PRODUCT_FILTERS } from "./ClientesMatrizCompras";

const COLS = "2.4fr 1.2fr .8fr 1fr .9fr";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  filterLabels: { key: Filter; label: string; count?: number }[];
  planFilter: string;
  onPlanFilterChange: (v: string) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (k: SortKey) => void;
  rows: CustomerRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onRowClick: (c: CustomerRow) => void;
  onExportCsv: () => void;
};

function SortArrowV2({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg
      width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`inline-block ml-1 transition-all ${active ? "opacity-100 text-muted" : "opacity-0 text-border"} ${active && dir === "desc" ? "" : "rotate-180"}`}
    >
      <path d="M6 10l6 6 6-6" />
    </svg>
  );
}

export default function ClientesTableV2({
  search, onSearchChange, filter, onFilterChange, filterLabels, planFilter, onPlanFilterChange,
  sortKey, sortDir, onToggleSort, rows, totalCount, page, pageSize, onPageChange, onRowClick, onExportCsv,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersActive = !!planFilter;
  const activeFilterCount = (filter !== "all" ? 1 : 0) + (planFilter ? 1 : 0);
  function clearFilters() {
    onFilterChange("all");
    onPlanFilterChange("");
  }

  return (
    <div>
      <div className="flex items-center gap-[9px] flex-wrap">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar por nombre o email…" className="min-w-[160px] flex-1" />
        <FiltersToggleButtonV2 open={filtersOpen} active={filtersActive} onClick={() => setFiltersOpen((v) => !v)} />
        <IconButtonV2 onClick={onExportCsv} title="Exportar tabla actual a CSV" className="sm:order-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
          </svg>
        </IconButtonV2>
        <div className={`${filtersOpen ? "flex" : "hidden"} sm:flex sm:order-1 items-center gap-[9px] flex-wrap w-full sm:w-auto`}>
          <Select variant="v2" value={planFilter} onChange={(e) => onPlanFilterChange(e.target.value)} className="w-auto">
            <option value="">Plan actual: todos</option>
            {PRODUCT_FILTERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value={SESSION_PLAN}>Por sesión</option>
          </Select>
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

      <div className="flex items-center justify-between gap-2.5 mt-3">
        <FilterPillGroupV2
          active={filter}
          onChange={onFilterChange}
          options={filterLabels.map((f) => ({ ...f, countTone: f.key === "error" ? "danger" as const : "warning" as const }))}
        />
        {activeFilterCount >= 2 && (
          <ClearFiltersButtonV2 onClick={clearFilters} className="hidden sm:flex" />
        )}
      </div>

      <div className={`mt-[24px] ${tableCardClassV2}`}>
        <div className="hidden sm:block">
          <div className={tableHeadClassV2} style={gridColsV2(COLS)}>
            <span
              className={`flex items-center cursor-pointer select-none ${sortKey === "name" ? "text-navy" : ""}`}
              onClick={() => onToggleSort("name")}
            >
              Cliente<SortArrowV2 active={sortKey === "name"} dir={sortDir} />
            </span>
            <span>Plan</span>
            <span
              className={`flex items-center cursor-pointer select-none ${sortKey === "totalSpent" ? "text-navy" : ""}`}
              onClick={() => onToggleSort("totalSpent")}
            >
              Total<SortArrowV2 active={sortKey === "totalSpent"} dir={sortDir} />
            </span>
            <span
              className={`flex items-center cursor-pointer select-none ${sortKey === "lastPaymentDate" ? "text-navy" : ""}`}
              onClick={() => onToggleSort("lastPaymentDate")}
            >
              Último pago<SortArrowV2 active={sortKey === "lastPaymentDate"} dir={sortDir} />
            </span>
            <span>Estado</span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-faint text-sm">No hay clientes que coincidan con tu búsqueda.</div>
        ) : (
          rows.map((c) => {
            const { status, days } = clientStatus(c);
            const dSub = c.daysSinceLastSub ?? Infinity;
            const dPack = c.daysSinceLastPack ?? Infinity;
            const planType = dSub <= dPack && dSub < Infinity ? "sub" : dPack < Infinity ? "pack" : "session";
            const planProduct = planType === "sub" ? c.lastSubProduct : planType === "pack" ? c.lastPackProduct : null;
            const planLabel = planProduct ? productAbbr(planProduct) : "Por sesión";
            const planColorCls = planProduct ? productColor(planProduct) : "bg-navy/[0.05] text-navy/50";
            const statusCfg =
              status === "baja"
                ? { color: "#dc2626", label: c.isRecurring ? `Baja · ${days}d` : `Pack vencido · ${days}d`, action: c.isRecurring ? "Contactar para recuperar" : "Ofrecer renovación" }
                : status === "sinpagar"
                ? { color: "#b45309", label: `Sin pagar · ${days}d tarde`, action: "Revisar cobro fallido" }
                : status === "caducado"
                ? { color: "#b45309", label: `Pack vencido · ${days}d`, action: "Ofrecer renovación" }
                : status === "porvencer"
                ? { color: "#d4a017", label: `Vence en ${days}d`, action: undefined }
                : { color: "#16a34a", label: "Al día", action: undefined };
            return (
              <div key={c.id}>
                {/* Fila escritorio */}
                <div className="hidden sm:block">
                  <div
                    onClick={() => onRowClick(c)}
                    className={`${tableRowClassV2} cursor-pointer`}
                    style={gridColsV2(COLS)}
                  >
                    <div className="flex items-center gap-[11px] min-w-0">
                      <Avatar seed={c.id} initials={initials(c.name, c.email)} size={30} />
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-navy truncate">{c.name ?? "-"}</p>
                        {c.email && <p className="text-[12px] text-faint truncate">{c.email}</p>}
                      </div>
                    </div>
                    <div>
                      <span className={`inline-block px-[11px] py-1 rounded-[8px] text-[12.5px] font-medium whitespace-nowrap ${planColorCls}`}>
                        {planLabel}
                      </span>
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-navy">{fmt(c.totalSpent)}</p>
                      <p className="text-[11px] text-faint">{c.paymentCount} pagos</p>
                    </div>
                    <div className="text-[13px] text-muted">{c.lastPaymentDate ? fmtDate(c.lastPaymentDate) : "-"}</div>
                    <div>
                      <span className="inline-flex items-center gap-[7px] border border-border rounded-full px-[11px] py-[3px] text-[12.5px] font-medium text-strong whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusCfg.color }} />
                        {statusCfg.label}
                      </span>
                      {statusCfg.action && (
                        <p className="text-[11px] text-faint italic mt-1">{statusCfg.action}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fila móvil */}
                <div
                  onClick={() => onRowClick(c)}
                  className="sm:hidden flex items-center gap-[10px] py-[10px] border-t border-subtle cursor-pointer active:bg-subtle"
                >
                  <Avatar seed={c.id} initials={initials(c.name, c.email)} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-navy truncate">{c.name ?? "-"}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-block px-[7px] py-[1px] rounded-[6px] text-[11px] font-medium whitespace-nowrap ${planColorCls}`}>
                        {planLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted whitespace-nowrap">
                        <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: statusCfg.color }} />
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-semibold text-navy">{fmt(c.totalSpent)}</p>
                    <p className="text-[11px] text-faint">{c.paymentCount} pagos</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <TablePaginationV2 page={page} totalItems={totalCount} pageSize={pageSize} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
