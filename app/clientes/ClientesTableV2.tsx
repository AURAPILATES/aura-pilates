import Avatar from "@/app/components/Avatar";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import { IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import { tableHeadClassV2, tableRowClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { fmt } from "@/lib/analytics";
import { clientStatus, planBadgeCfg, initials, fmtDate, type CustomerRow, type Filter, type SortKey, type SortDir } from "./ClientesTable";

const COLS = "2.4fr 1.2fr .8fr 1fr .9fr";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  filter: Filter;
  onFilterChange: (f: Filter) => void;
  filterLabels: { key: Filter; label: string; count?: number }[];
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
      className={`inline-block ml-1 transition-all ${active ? "opacity-100 text-[#52525b]" : "opacity-0 text-[#cfcfd4]"} ${active && dir === "desc" ? "" : "rotate-180"}`}
    >
      <path d="M6 10l6 6 6-6" />
    </svg>
  );
}

export default function ClientesTableV2({
  search, onSearchChange, filter, onFilterChange, filterLabels,
  sortKey, sortDir, onToggleSort, rows, totalCount, page, pageSize, onPageChange, onRowClick, onExportCsv,
}: Props) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar por nombre o email…" className="flex-1" />
        <IconButtonV2 onClick={onExportCsv} title="Exportar tabla actual a CSV">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
          </svg>
        </IconButtonV2>
      </div>

      <FilterPillGroupV2
        className="mt-3"
        active={filter}
        onChange={onFilterChange}
        options={filterLabels.map((f) => ({ ...f, countTone: f.key === "error" ? "danger" as const : "warning" as const }))}
      />

      <div className="mt-[24px]">
        <div className={tableHeadClassV2} style={gridColsV2(COLS)}>
          <span className="flex items-center cursor-pointer select-none" onClick={() => onToggleSort("name")}>
            Cliente<SortArrowV2 active={sortKey === "name"} dir={sortDir} />
          </span>
          <span>Plan</span>
          <span className="flex items-center cursor-pointer select-none" onClick={() => onToggleSort("totalSpent")}>
            Total<SortArrowV2 active={sortKey === "totalSpent"} dir={sortDir} />
          </span>
          <span className="flex items-center cursor-pointer select-none" onClick={() => onToggleSort("lastPaymentDate")}>
            Último pago<SortArrowV2 active={sortKey === "lastPaymentDate"} dir={sortDir} />
          </span>
          <span>Estado</span>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-[#a1a1aa] text-sm">No hay clientes que coincidan con tu búsqueda.</div>
        ) : (
          rows.map((c) => {
            const { status, days } = clientStatus(c);
            const dSub = c.daysSinceLastSub ?? Infinity;
            const dPack = c.daysSinceLastPack ?? Infinity;
            const planType = dSub <= dPack && dSub < Infinity ? "sub" : dPack < Infinity ? "pack" : "session";
            const { label: planLabel } = planBadgeCfg(planType, c.lastSubProduct, c.lastPackProduct);
            const statusCfg =
              status === "baja"
                ? { color: "#dc2626", label: c.isRecurring ? `Baja · ${days}d` : `Pack vencido · ${days}d` }
                : status === "sinpagar"
                ? { color: "#b45309", label: `Sin pagar · ${days}d tarde` }
                : status === "caducado"
                ? { color: "#b45309", label: `Pack vencido · ${days}d` }
                : status === "porvencer"
                ? { color: "#d4a017", label: `Vence en ${days}d` }
                : { color: "#16a34a", label: "Al día" };
            return (
              <div
                key={c.id}
                onClick={() => onRowClick(c)}
                className={`${tableRowClassV2} cursor-pointer`}
                style={gridColsV2(COLS)}
              >
                <div className="flex items-center gap-[11px] min-w-0">
                  <Avatar seed={c.id} initials={initials(c.name, c.email)} size={30} />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#18181b] truncate">{c.name ?? "—"}</p>
                    {c.email && <p className="text-[12px] text-[#a1a1aa] truncate">{c.email}</p>}
                  </div>
                </div>
                <div>
                  <span className="inline-block px-[11px] py-1 rounded-[8px] bg-[#f3effc] text-[#7c3aed] text-[12.5px] font-medium whitespace-nowrap">
                    {planLabel}
                  </span>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#18181b]">{fmt(c.totalSpent)}</p>
                  <p className="text-[11px] text-[#a1a1aa]">{c.paymentCount} pagos</p>
                </div>
                <div className="text-[13px] text-[#71717a]">{c.lastPaymentDate ? fmtDate(c.lastPaymentDate) : "—"}</div>
                <div>
                  <span className="inline-flex items-center gap-[7px] border border-[#e6e6ea] rounded-full px-[11px] py-[3px] text-[12.5px] font-medium text-[#3f3f46] whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusCfg.color }} />
                    {statusCfg.label}
                  </span>
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
