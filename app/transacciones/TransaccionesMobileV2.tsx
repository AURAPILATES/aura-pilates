import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import { MobileCardV2, MobileIconSquircleV2, MobileChevronButtonV2, MobileSearchBarV2 } from "@/app/components/v2/mobile/MobileV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import { fmtAmt, fmtDayLabel, OriginIcon, originLabel, FALLBACK_COLOR, FALLBACK_ICON } from "./TransaccionesList";
import { CatIcon } from "./catIcons";
import ImportButton from "./ImportButton";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  directionFilter: "all" | "in" | "out";
  onDirectionFilterChange: (v: "all" | "in" | "out") => void;
  totalIn: number;
  totalOut: number;
  neto: number;
  byDay: [string, Transaction[]][];
  categories: Category[];
  recurringPeriods: Record<string, string>;
  onRowClick: (id: string) => void;
  onManual: () => void;
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (p: number) => void;
};

export default function TransaccionesMobileV2({
  search, onSearchChange, directionFilter, onDirectionFilterChange, totalIn, totalOut, neto,
  byDay, categories, recurringPeriods, onRowClick, onManual, page, totalItems, pageSize, onPageChange,
}: Props) {
  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          type="button"
          onClick={() => onDirectionFilterChange(directionFilter === "in" ? "all" : "in")}
          className={`text-center rounded-[16px] py-3 px-2 transition-colors ${directionFilter === "in" ? "bg-[#16a34a]/10" : "bg-white"}`}
          style={{ boxShadow: "0 1px 2px rgba(24,24,27,.04), 0 6px 16px -8px rgba(24,24,27,.10)" }}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wide text-[#a1a1aa] mb-1">Entradas</p>
          <p className="text-[13px] font-bold text-[#16a34a] truncate">{fmtAmt(totalIn)}</p>
        </button>
        <button
          type="button"
          onClick={() => onDirectionFilterChange(directionFilter === "out" ? "all" : "out")}
          className={`text-center rounded-[16px] py-3 px-2 transition-colors ${directionFilter === "out" ? "bg-[#b53e0d]/10" : "bg-white"}`}
          style={{ boxShadow: "0 1px 2px rgba(24,24,27,.04), 0 6px 16px -8px rgba(24,24,27,.10)" }}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wide text-[#a1a1aa] mb-1">Salidas</p>
          <p className="text-[13px] font-bold text-[#b53e0d] truncate">{fmtAmt(totalOut)}</p>
        </button>
        <div
          className="text-center rounded-[16px] py-3 px-2 bg-white"
          style={{ boxShadow: "0 1px 2px rgba(24,24,27,.04), 0 6px 16px -8px rgba(24,24,27,.10)" }}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wide text-[#a1a1aa] mb-1">Dif.</p>
          <p className={`text-[13px] font-bold truncate ${neto >= 0 ? "text-[#18181b]" : "text-[#b53e0d]"}`}>
            {neto < 0 && "−"}{fmtAmt(Math.abs(neto))}
          </p>
        </div>
      </div>

      <MobileSearchBarV2 value={search} onChange={onSearchChange} placeholder="Buscar concepto o contacto…" />

      <div className="mt-3">
        <ImportButton compact className="w-full" onManual={onManual} />
      </div>

      <div className="space-y-5 mt-4">
        {byDay.length === 0 && (
          <p className="py-10 text-center text-sm text-[#a1a1aa]">Sin resultados</p>
        )}
        {byDay.map(([date, dayTxns]) => {
          const dayNet = dayTxns.reduce((s, t) => s + t.amount, 0);
          return (
            <div key={date}>
              <div className="flex items-baseline justify-between mb-2 px-1">
                <span className="text-[15px] font-bold text-[#18181b]">{fmtDayLabel(date)}</span>
                <span className="text-xs tabular-nums text-[#a1a1aa]">
                  {dayNet < 0 ? "−" : "+"}{fmtAmt(Math.abs(dayNet))}
                </span>
              </div>
              <MobileCardV2 className="divide-y divide-[#f4f4f6]">
                {dayTxns.map((t) => {
                  const recurringPeriod = recurringPeriods[t.id];
                  const primary = t.contact || t.concept || "—";
                  const secondary = t.contact && t.concept && t.concept !== t.contact ? t.concept : null;
                  const cat = t.category ? categories.find((c) => c.value === t.category) : undefined;
                  const accent = cat?.text_color ?? (t.amount > 0 ? FALLBACK_COLOR.in : FALLBACK_COLOR.out);
                  const iconKey = cat?.emoji ?? (t.amount > 0 ? FALLBACK_ICON.in : FALLBACK_ICON.out);
                  return (
                    <div
                      key={t.id}
                      onClick={() => onRowClick(t.id)}
                      className="flex items-center gap-3 p-3"
                    >
                      <MobileIconSquircleV2 bg={accent}>
                        <CatIcon iconKey={iconKey} name={cat?.label ?? primary} color="#fff" size={18} />
                      </MobileIconSquircleV2>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-[#18181b] truncate">{primary}</p>
                        {secondary && <p className="text-[12px] text-[#a1a1aa] truncate">{secondary}</p>}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#a1a1aa]">
                            <OriginIcon method={t.payment_method} />
                            {originLabel(t.payment_method)}
                          </span>
                          {recurringPeriod && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                              <path d="M1 4v6h6M23 20v-6h-6" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-[14px] font-semibold ${t.amount > 0 ? "text-[#16a34a]" : "text-[#18181b]"}`}>
                          {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
                        </p>
                      </div>
                      <MobileChevronButtonV2 onClick={(e) => { e.stopPropagation(); onRowClick(t.id); }} />
                    </div>
                  );
                })}
              </MobileCardV2>
            </div>
          );
        })}
      </div>

      {byDay.length > 0 && (
        <TablePaginationV2 page={page} totalItems={totalItems} pageSize={pageSize} onPageChange={onPageChange} />
      )}
    </div>
  );
}
