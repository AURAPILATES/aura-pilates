"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/categories";
import type { RecurringExpense } from "@/lib/recurringExpenses";
import type { Contact } from "./actions";
import type { PendingSeriesRow, ConfirmedExpenseRow, ContactPick } from "./RecurrentesList";
import { fmtEUR, pickToLabel } from "./RecurrentesList";
import { CategoryBadge, CAT_FALLBACK } from "./TransaccionesList";
import { CatIcon } from "./catIcons";
import { setRecurringExpenseStatus, deleteRecurringExpense } from "./recurringActions";
import Drawer from "@/app/components/Drawer";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import TaxBadgeV2 from "@/app/components/v2/TaxBadgeV2";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import { IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import { tableHeadClassV2, tableRowClassV2, tableGroupClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";

const COLS = "2.1fr 1.2fr 1.1fr .9fr .9fr 1fr";

const DAY_NAMES_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "lunes"/"martes"… para periodos semanales/quincenales, "día N" para el resto (mensual,
 * bimestral, trimestral…) — a partir del último pago detectado. */
function periodDayDetail(period: string, lastDate: string | null | undefined): string | null {
  if (!lastDate) return null;
  const d = new Date(lastDate + "T12:00:00");
  const p = period.toLowerCase();
  if (p === "semanal" || p === "quincenal") return DAY_NAMES_ES[d.getDay()];
  return `día ${d.getDate()}`;
}

function iconFor(categories: Category[], categoryValue: string | null) {
  const cat = categoryValue ? categories.find((c) => c.value === categoryValue) : undefined;
  return {
    accent: cat ? cat.text_color : CAT_FALLBACK.color,
    iconKey: cat ? cat.emoji : CAT_FALLBACK.emoji,
    label: cat?.label,
  };
}

type Props = {
  pending: PendingSeriesRow[];
  confirmed: ConfirmedExpenseRow[];
  confirmedPageRows: ConfirmedExpenseRow[];
  archived: RecurringExpense[];
  categories: Category[];
  contacts: Contact[];
  search: string;
  onSearchChange: (v: string) => void;
  pickFor: (row: PendingSeriesRow) => ContactPick;
  ivaRateFor: (row: PendingSeriesRow) => number;
  retencionRateFor: (row: PendingSeriesRow) => number;
  onOpenPending: (row: PendingSeriesRow) => void;
  onOpenConfirmed: (row: ConfirmedExpenseRow) => void;
  onConfirmRow: (row: PendingSeriesRow) => Promise<void>;
  confirmedPage: number;
  pageSize: number;
  onConfirmedPageChange: (p: number) => void;
};

function ArchivedRowV2({ row }: { row: RecurringExpense }) {
  const router = useRouter();
  async function reactivate() {
    await setRecurringExpenseStatus(row.id, "confirmed");
    router.refresh();
  }
  async function remove() {
    await deleteRecurringExpense(row.id);
    router.refresh();
  }
  return (
    <div className="px-6 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy truncate">{row.label}</p>
        <p className="text-xs text-navy/45 mt-0.5">
          {row.status === "ignored" ? "Ignorado" : "Dado de baja"} · {fmtEUR(Math.abs(row.amount))} · {row.period}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={reactivate} className="text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors">
          Reactivar
        </button>
        <button onClick={remove} className="text-xs font-semibold text-danger/70 border border-danger/20 hover:bg-danger/5 px-3 py-1.5 rounded-lg transition-colors">
          Eliminar
        </button>
      </div>
    </div>
  );
}

export default function RecurrentesListV2({
  pending, confirmed, confirmedPageRows, archived, categories, contacts, search, onSearchChange, pickFor, ivaRateFor, retencionRateFor,
  onOpenPending, onOpenConfirmed, onConfirmRow, confirmedPage, pageSize, onConfirmedPageChange,
}: Props) {
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-[9px]">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar recurrente…" className="min-w-[160px] flex-1" />
        <IconButtonV2
          onClick={() => setShowArchived(true)}
          title={`Archivados${archived.length > 0 ? ` (${archived.length})` : ""}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
          </svg>
        </IconButtonV2>
      </div>

      {showArchived && (
        <Drawer
          title="Recurrentes archivados"
          subtitle="Ignorados o dados de baja — no se proyectan en la previsión de cashflow"
          onClose={() => setShowArchived(false)}
        >
          {archived.length === 0 ? (
            <p className="px-6 py-8 text-sm text-navy/40 text-center">Sin recurrentes archivados</p>
          ) : (
            <div className="divide-y divide-navy/[0.05]">
              {archived.map((row) => <ArchivedRowV2 key={row.id} row={row} />)}
            </div>
          )}
        </Drawer>
      )}

      <div className="mt-[24px]">
      <div className="hidden sm:block">
        <div className={tableHeadClassV2} style={gridColsV2(COLS)}>
          <span>Concepto</span>
          <span>Categoría</span>
          <span>Periodicidad</span>
          <span>IVA / Ret</span>
          <span className="text-right">Importe</span>
          <span className="text-right">Estado</span>
        </div>
      </div>

      {pending.length > 0 && (
        <>
          <div className={tableGroupClassV2}>
            <span className="flex items-center gap-2">
              <span className="w-[7px] h-[7px] rounded-full bg-[#b45309]" />
              POR CONFIRMAR
            </span>
            <span className="text-[#a1a1aa] font-normal normal-case">{pending.length}</span>
          </div>
          {pending.map((row) => {
            const pick = pickFor(row);
            const linked = !!pick;
            const ivaRate = ivaRateFor(row);
            const retRate = retencionRateFor(row);
            const icon = iconFor(categories, row.category);
            const dayDetail = periodDayDetail(row.period, row.lastDate);
            return (
              <div key={row.keys[0]}>
                {/* Fila escritorio */}
                <div className="hidden sm:block">
                  <div
                    onClick={() => onOpenPending(row)}
                    className={`${tableRowClassV2} cursor-pointer`}
                    style={gridColsV2(COLS)}
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      <span className="w-[30px] h-[30px] shrink-0 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: icon.accent }}>
                        <CatIcon iconKey={icon.iconKey} name={icon.label ?? row.label} color="#fff" size={14} />
                      </span>
                      <p className="text-[13.5px] font-medium text-[#18181b] truncate">{row.label}</p>
                    </div>
                    <div>{row.category && <CategoryBadge category={row.category} categories={categories} />}</div>
                    <div>
                      <p className="text-[12.5px] text-[#71717a] capitalize">{row.period}</p>
                      {dayDetail && <p className="text-[11px] text-[#a1a1aa] capitalize">{dayDetail}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TaxBadgeV2 value={ivaRate} isError={false} />
                      <TaxBadgeV2 value={retRate} isError={false} />
                    </div>
                    <p className="text-right text-[13.5px] font-semibold text-[#18181b]">{fmtEUR(Math.abs(row.amount))}</p>
                    <div className="flex justify-end">
                      {linked ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void onConfirmRow(row); }}
                          title={`Vinculado a ${pickToLabel(pick, contacts)}`}
                          className="inline-flex items-center gap-1.5 bg-[#fef3e2] text-[#b45309] rounded-full px-[11px] py-1 text-[12px] font-semibold whitespace-nowrap hover:bg-[#fce8c8] transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l4 4 10-10" />
                          </svg>
                          Confirmar
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-[#f2f2f4] text-[#71717a] rounded-full px-[11px] py-1 text-[12px] font-medium whitespace-nowrap">
                          Sin vincular
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fila móvil */}
                <div
                  onClick={() => onOpenPending(row)}
                  className="sm:hidden flex items-center gap-[10px] py-[10px] border-t border-[#f4f4f4] cursor-pointer active:bg-[#fafafb]"
                >
                  <span className="w-[32px] h-[32px] shrink-0 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: icon.accent }}>
                    <CatIcon iconKey={icon.iconKey} name={icon.label ?? row.label} color="#fff" size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#18181b] truncate">{row.label}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {row.category && <CategoryBadge category={row.category} categories={categories} />}
                      <span className="text-[11.5px] text-[#71717a] capitalize">{row.period}{dayDetail ? ` · ${dayDetail}` : ""}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-semibold text-[#18181b]">{fmtEUR(Math.abs(row.amount))}</p>
                    {linked ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void onConfirmRow(row); }}
                        title={`Vinculado a ${pickToLabel(pick, contacts)}`}
                        className="mt-1 inline-flex items-center gap-1 bg-[#fef3e2] text-[#b45309] rounded-full px-[9px] py-[3px] text-[11px] font-semibold whitespace-nowrap"
                      >
                        Confirmar
                      </button>
                    ) : (
                      <span className="mt-1 inline-block bg-[#f2f2f4] text-[#71717a] rounded-full px-[9px] py-[3px] text-[11px] font-medium whitespace-nowrap">
                        Sin vincular
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      <div className={tableGroupClassV2}>
        <span className="flex items-center gap-2">
          <span className="w-[7px] h-[7px] rounded-full bg-[#16a34a]" />
          ACTIVOS
        </span>
        <span className="text-[#a1a1aa] font-normal normal-case">{confirmed.length}</span>
      </div>
      {confirmed.length === 0 ? (
        <p className="text-sm text-[#a1a1aa] py-6">
          {search.trim() ? "Sin resultados" : "Sin gastos recurrentes confirmados todavía."}
        </p>
      ) : (
        confirmedPageRows.map((row) => {
          const e = row.expense;
          const contact = e.contact_id != null ? contacts.find((c) => c.id === e.contact_id) : undefined;
          const ivaRate = contact?.ivaRate ?? 0;
          const retRate = contact?.retencionRate ?? 0;
          const bothMissing = !(ivaRate > 0) && !(retRate > 0);
          const icon = iconFor(categories, e.category);
          const dayDetail = periodDayDetail(e.period, row.lastDate);
          return (
            <div key={e.id}>
              {/* Fila escritorio */}
              <div className="hidden sm:block">
                <div
                  onClick={() => onOpenConfirmed(row)}
                  className={`${tableRowClassV2} cursor-pointer`}
                  style={gridColsV2(COLS)}
                >
                  <div className="flex items-center gap-[10px] min-w-0">
                    <span className="w-[30px] h-[30px] shrink-0 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: icon.accent }}>
                      <CatIcon iconKey={icon.iconKey} name={icon.label ?? e.label} color="#fff" size={14} />
                    </span>
                    <p className="text-[13.5px] font-medium text-[#18181b] truncate">{e.label}</p>
                  </div>
                  <div>{e.category && <CategoryBadge category={e.category} categories={categories} />}</div>
                  <div>
                    <p className="text-[12.5px] text-[#71717a] capitalize">{e.period}</p>
                    {dayDetail && <p className="text-[11px] text-[#a1a1aa] capitalize">{dayDetail}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TaxBadgeV2 value={ivaRate} isError={bothMissing} />
                    <TaxBadgeV2 value={retRate} isError={bothMissing} />
                  </div>
                  <p className="text-right text-[13.5px] font-semibold text-[#18181b]">{fmtEUR(Math.abs(e.amount))}</p>
                  <div className="flex justify-end">
                    <span className="inline-flex items-center gap-1.5 text-[#16a34a] text-[12.5px] font-medium whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                      Activo
                    </span>
                  </div>
                </div>
              </div>

              {/* Fila móvil */}
              <div
                onClick={() => onOpenConfirmed(row)}
                className="sm:hidden flex items-center gap-[10px] py-[10px] border-t border-[#f4f4f4] cursor-pointer active:bg-[#fafafb]"
              >
                <span className="w-[32px] h-[32px] shrink-0 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: icon.accent }}>
                  <CatIcon iconKey={icon.iconKey} name={icon.label ?? e.label} color="#fff" size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-[#18181b] truncate">{e.label}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {e.category && <CategoryBadge category={e.category} categories={categories} />}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-semibold text-[#18181b]">{fmtEUR(Math.abs(e.amount))}</p>
                  <p className="text-[11.5px] text-[#71717a] capitalize mt-0.5">{e.period}{dayDetail ? ` · ${dayDetail}` : ""}</p>
                </div>
              </div>
            </div>
          );
        })
      )}
      {confirmed.length > 0 && (
        <TablePaginationV2 page={confirmedPage} totalItems={confirmed.length} pageSize={pageSize} onPageChange={onConfirmedPageChange} />
      )}
      </div>
    </div>
  );
}
