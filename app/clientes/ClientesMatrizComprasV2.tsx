import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import Select from "@/app/components/Select";
import { IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import { fmt } from "@/lib/analytics";
import { PRODUCT_FILTERS, monthLabel, productAbbr, productColor, type MatrixRow, type SortKey } from "./ClientesMatrizCompras";

const NAME_COL_W = 130;
const FIRST_COL_W = 110;
const MONTH_COL_W = 76;
const TOTAL_COL_W = 110;

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  productFilter: string;
  onProductFilterChange: (v: string) => void;
  firstPurchaseFilter: string;
  onFirstPurchaseFilterChange: (v: string) => void;
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
  return <span className="text-[#52525b]">{dir === "asc" ? " ▲" : " ▼"}</span>;
}

export default function ClientesMatrizComprasV2({
  search, onSearchChange, productFilter, onProductFilterChange, firstPurchaseFilter, onFirstPurchaseFilterChange,
  onlyInactive, onToggleOnlyInactive, onlyUpsell, onToggleOnlyUpsell, lastMonth, months, rows,
  sortKey, sortDir, onToggleSort, monthTotals, grandTotal, totalCount, page, pageSize, onPageChange, onRowClick, onExportCsv,
}: Props) {
  const tableWidthPx = NAME_COL_W + FIRST_COL_W + months.length * MONTH_COL_W + TOTAL_COL_W;

  return (
    <div className="flex flex-col items-center">
      <div className="w-full flex items-center gap-[9px] flex-wrap">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar cliente…" className="min-w-[200px] flex-1" />
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
        <button
          type="button"
          onClick={onToggleOnlyInactive}
          className={`text-[13px] px-[13px] py-2 rounded-[10px] border whitespace-nowrap transition-colors ${
            onlyInactive ? "border-[#18181b] bg-[#18181b] text-white font-medium" : "border-[#e6e6ea] bg-white text-[#3f3f46] hover:bg-[#18181b]/[0.02]"
          }`}
        >
          Sin compra en {lastMonth ? monthLabel(lastMonth) : "el último mes"}
        </button>
        <button
          type="button"
          onClick={onToggleOnlyUpsell}
          title="Clientes en Bàsic desde hace 3 meses o más que nunca han subido a Plus o Pro"
          className={`text-[13px] px-[13px] py-2 rounded-[10px] border whitespace-nowrap transition-colors ${
            onlyUpsell ? "border-[#18181b] bg-[#18181b] text-white font-medium" : "border-[#e6e6ea] bg-white text-[#3f3f46] hover:bg-[#18181b]/[0.02]"
          }`}
        >
          Candidatos a upsell
        </button>
        <IconButtonV2 onClick={onExportCsv} title="Exportar vista actual a CSV">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
          </svg>
        </IconButtonV2>
      </div>

      <div className="mt-[18px] overflow-x-auto max-w-full" style={{ width: tableWidthPx }}>
        <table className="text-xs" style={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0, width: tableWidthPx }}>
          <colgroup>
            <col style={{ width: NAME_COL_W }} />
            <col style={{ width: FIRST_COL_W }} />
            {months.map((m) => (
              <col key={m} style={{ width: MONTH_COL_W }} />
            ))}
            <col style={{ width: TOTAL_COL_W }} />
          </colgroup>
          <thead>
            <tr className="border-b border-[#ececef]">
              <th
                onClick={() => onToggleSort("name")}
                className="sticky left-0 bg-white text-left py-2.5 pr-3 text-[10.5px] font-semibold text-[#a1a1aa] uppercase tracking-wide whitespace-nowrap z-10 cursor-pointer select-none hover:text-[#71717a]"
              >
                Cliente{sortArrow(sortKey === "name", sortDir)}
              </th>
              <th
                onClick={() => onToggleSort("first")}
                className="sticky left-[130px] bg-white text-center py-2.5 px-1 text-[10px] leading-tight font-semibold text-[#a1a1aa] uppercase tracking-wide z-10 cursor-pointer select-none hover:text-[#71717a]"
              >
                Primera<br />compra{sortArrow(sortKey === "first", sortDir)}
              </th>
              {months.map((m) => (
                <th key={m} className="text-center py-2.5 px-1 text-[10.5px] font-semibold text-[#a1a1aa] uppercase tracking-wide whitespace-nowrap">
                  {monthLabel(m)}
                </th>
              ))}
              <th
                onClick={() => onToggleSort("total")}
                className="sticky right-0 bg-white text-right py-2.5 pr-1 text-[10.5px] font-semibold text-[#a1a1aa] uppercase tracking-wide z-10 cursor-pointer select-none hover:text-[#71717a]"
              >
                Total{sortArrow(sortKey === "total", sortDir)}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={months.length + 3} className="py-6 text-center text-[#a1a1aa]">
                  Sin resultados
                </td>
              </tr>
            )}
            {rows.map(({ customer, byMonth, totalPaid, firstPurchase }) => (
              <tr
                key={customer.id}
                onClick={() => onRowClick(customer)}
                className="border-t border-[#f4f4f4] hover:bg-[#fafafb] transition-colors cursor-pointer"
              >
                <td className="sticky left-0 bg-white py-2 pr-3 font-semibold text-[#18181b] whitespace-nowrap z-10 truncate" title={customer.name ?? customer.email ?? undefined}>
                  {customer.name ?? customer.email ?? "—"}
                </td>
                <td className="sticky left-[130px] bg-white py-2 px-1 text-center text-[#71717a] whitespace-nowrap z-10">
                  {firstPurchase ? monthLabel(firstPurchase.slice(0, 7)) : "—"}
                </td>
                {months.map((m) => {
                  const purchases = byMonth[m];
                  if (!purchases || purchases.length === 0) {
                    return <td key={m} className="py-1.5 px-1 text-center" />;
                  }
                  const products = [...new Map(purchases.map((p) => [p.product, p])).keys()];
                  const total = purchases.reduce((s, p) => s + p.amount, 0);
                  const colorCls = productColor(products[0]);
                  return (
                    <td key={m} className="py-1.5 px-1 text-center">
                      <div className={`rounded-[8px] px-1.5 py-1 flex flex-col items-center gap-0.5 ${colorCls} min-w-[68px]`}>
                        {products.map((prod) => (
                          <span key={prod} className="text-[10px] font-semibold leading-tight">
                            {productAbbr(prod)}
                          </span>
                        ))}
                        <span className="text-[9px] opacity-60 leading-tight font-medium">{fmt(total)}</span>
                      </div>
                    </td>
                  );
                })}
                <td className="sticky right-0 bg-white py-2 pr-1 text-right whitespace-nowrap z-10">
                  <span className="text-[11px] font-semibold text-[#18181b] tabular-nums">{fmt(totalPaid)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-[#ececef]">
                <td className="sticky left-0 bg-white py-2 pr-3 font-semibold text-[#71717a] text-[10.5px] uppercase tracking-wide z-10">
                  Total
                </td>
                <td className="sticky left-[130px] bg-white z-10" />
                {months.map((m) => (
                  <td key={m} className="py-2 px-1 text-center text-[10.5px] font-semibold text-[#71717a] tabular-nums">
                    {monthTotals[m] > 0 ? fmt(monthTotals[m]) : "—"}
                  </td>
                ))}
                <td className="sticky right-0 bg-white py-2 pr-1 text-right z-10">
                  <span className="text-[10.5px] font-bold text-[#18181b] tabular-nums">{fmt(grandTotal)}</span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="w-full" style={{ maxWidth: tableWidthPx }}>
        <TablePaginationV2 page={page} totalItems={totalCount} pageSize={pageSize} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
