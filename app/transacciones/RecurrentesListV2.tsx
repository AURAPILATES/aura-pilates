"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sortCategoriesHierarchical, categoryDisplayLabel, type Category } from "@/lib/categories";
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
import { IconButtonV2, PrimaryButtonV2 } from "@/app/components/v2/ButtonsV2";
import HeaderPortal from "@/app/components/HeaderPortal";
import { tableHeadClassV2, tableRowClassV2, tableGroupClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";

const COLS = "2.1fr 1.2fr 1.1fr .9fr .9fr 1fr";

/** Barra flotante de acciones masivas, centrada abajo - aparece al seleccionar filas
 * confirmadas (checkbox al hover sobre el icono de categoría, ver fila de escritorio más
 * abajo). Solo escritorio, y solo aplica a recurrentes ya confirmados (los pendientes no
 * tienen fila propia en `recurring_expenses` todavía). */
function BulkActionBarV2({
  count, categories, contacts, onClear, onSetContact, onSetCategory, onDelete,
}: {
  count: number;
  categories: Category[];
  contacts: Contact[];
  onClear: () => void;
  onSetContact: (contactId: number) => void;
  onSetCategory: (category: string | null) => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "contact" | "category" | "delete">("idle");
  const [contactDraft, setContactDraft] = useState("");
  const [catDraft, setCatDraft] = useState("");

  function submitContact() {
    if (!contactDraft) return;
    onSetContact(parseInt(contactDraft, 10));
    setMode("idle");
    setContactDraft("");
  }
  function submitCategory() {
    if (!catDraft) return;
    onSetCategory(catDraft === "__null__" ? null : catDraft);
    setMode("idle");
    setCatDraft("");
  }

  return (
    <div className="flex fixed z-30 items-center justify-between gap-2 bg-navy text-app-bg shadow-lg pl-4 pr-2 py-2 left-1/2 -translate-x-1/2 bottom-[6px] w-[94%] rounded-[6px] sm:bottom-6 sm:w-auto sm:rounded-[14px]">
      <div className="flex items-center gap-2 min-w-0 overflow-x-auto scrollbar-none">
      <span className="text-[13px] font-medium whitespace-nowrap">{count} sel.<span className="hidden sm:inline">eccionado{count !== 1 ? "s" : ""}</span></span>
      <div className="w-px h-5 bg-app-bg/15 shrink-0" />
      {mode === "contact" ? (
        <div className="flex items-center gap-1.5">
          <select
            autoFocus
            value={contactDraft}
            onChange={(e) => setContactDraft(e.target.value)}
            className="text-[13px] rounded-[7px] px-2 py-1 bg-app-bg/10 text-app-bg border border-app-bg/20 outline-none focus:border-app-bg/40 max-w-[130px] sm:max-w-[160px] cursor-pointer"
          >
            <option value="" disabled className="text-navy">Contacto…</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id} className="text-navy">{c.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={submitContact}
            disabled={!contactDraft}
            className="text-[12px] font-semibold text-navy bg-app-bg hover:bg-app-bg/85 disabled:opacity-40 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap"
          >
            Aplicar
          </button>
          <button type="button" onClick={() => setMode("idle")} className="text-app-bg/50 hover:text-app-bg text-[12px] px-1">
            Cancelar
          </button>
        </div>
      ) : mode === "category" ? (
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
          <button type="button" onClick={() => setMode("contact")} className="text-[12.5px] font-medium text-app-bg/85 hover:text-app-bg hover:bg-app-bg/10 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">
            <span className="sm:hidden">Contacto</span><span className="hidden sm:inline">Cambiar contacto</span>
          </button>
          <button type="button" onClick={() => setMode("category")} className="text-[12.5px] font-medium text-app-bg/85 hover:text-app-bg hover:bg-app-bg/10 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">
            <span className="sm:hidden">Categoría</span><span className="hidden sm:inline">Cambiar categoría</span>
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

const DAY_NAMES_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "lunes"/"martes"… para periodos semanales/quincenales, "día N" para el resto (mensual,
 * bimestral, trimestral…) - a partir del último pago detectado. */
function periodDayDetail(period: string, lastDate: string | null | undefined): string | null {
  if (!lastDate) return null;
  const d = new Date(lastDate + "T12:00:00");
  const p = period.toLowerCase();
  if (p === "semanal" || p === "quincenal") return DAY_NAMES_ES[d.getDay()];
  return `día ${d.getDate()}`;
}

/** Importe con signo y color, igual que en Movimientos: verde "+" para ingresos, oscuro "−"
 * para gastos (la mayoría de recurrentes) - en vez de mostrar siempre el valor absoluto. */
function SignedAmount({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`${amount > 0 ? "text-[#13803a] dark:text-[#7cdfa0]" : "text-navy"} ${className}`}>
      {amount > 0 ? "+" : "−"}{fmtEUR(Math.abs(amount))}
    </span>
  );
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
  onNewManual?: () => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: (ids: number[]) => void;
  onClearSelection: () => void;
  onBulkContact: (contactId: number) => void;
  onBulkCategory: (category: string | null) => void;
  onBulkDelete: () => void;
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
  onOpenPending, onOpenConfirmed, onConfirmRow, confirmedPage, pageSize, onConfirmedPageChange, onNewManual,
  selectedIds, onToggleSelect, onToggleSelectAll, onClearSelection, onBulkContact, onBulkCategory, onBulkDelete,
}: Props) {
  const [showArchived, setShowArchived] = useState(false);
  // Modo selección solo para móvil (en escritorio se usa el checkbox al hover): tocar una
  // fila confirmada la marca en vez de abrir su detalle.
  const [selectionMode, setSelectionMode] = useState(false);
  const confirmedPageIds = confirmedPageRows.map((row) => row.expense.id);
  const allConfirmedSelected = confirmedPageIds.length > 0 && confirmedPageIds.every((id) => selectedIds.has(id));
  const someConfirmedSelected = confirmedPageIds.some((id) => selectedIds.has(id));

  function exitSelectionMode() {
    setSelectionMode(false);
    onClearSelection();
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar recurrente…" className="min-w-[160px] flex-1" />
        {confirmed.length > 0 && (
          <button
            type="button"
            onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
            title={selectionMode ? "Cancelar selección" : "Seleccionar varios"}
            className={`sm:hidden shrink-0 flex items-center justify-center w-[38px] h-[38px] rounded-[10px] border transition-colors ${
              selectionMode ? "border-navy bg-navy text-app-bg" : "border-border bg-card text-muted"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </button>
        )}
      </div>

      <HeaderPortal>
        <div className="flex items-center gap-2.5">
          <IconButtonV2
            onClick={() => setShowArchived(true)}
            title={`Archivados${archived.length > 0 ? ` (${archived.length})` : ""}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          </IconButtonV2>
          <PrimaryButtonV2
            onClick={onNewManual}
            label="Nuevo recurrente"
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
          />
        </div>
      </HeaderPortal>

      {showArchived && (
        <Drawer
          title="Recurrentes archivados"
          subtitle="Ignorados o dados de baja - no se proyectan en la previsión de cashflow"
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

      <div className={`mt-2 sm:mt-[24px] -mx-2 sm:-mx-6 ${tableCardClassV2} overflow-hidden`}>
      <div className="hidden sm:block">
        <div className={`${tableHeadClassV2} px-5`} style={gridColsV2(COLS)}>
          <span className="flex items-center gap-[10px]">
            <span className="w-[30px] h-[30px] shrink-0 flex items-center justify-center">
              <input
                type="checkbox"
                checked={allConfirmedSelected}
                ref={(el) => { if (el) el.indeterminate = !allConfirmedSelected && someConfirmedSelected; }}
                onChange={() => onToggleSelectAll(confirmedPageIds)}
                className="w-[13px] h-[13px] rounded-[4px] border-border accent-navy focus:ring-navy/20 cursor-pointer"
              />
            </span>
            Concepto
          </span>
          <span>Categoría</span>
          <span>Periodicidad</span>
          <span>IVA / Ret</span>
          <span className="text-right">Importe</span>
          <span className="text-right">Estado</span>
        </div>
      </div>

      {pending.length > 0 && (
        <>
          <div className={`${tableGroupClassV2} px-5`}>
            <span className="flex items-center gap-2">
              <span className="w-[7px] h-[7px] rounded-full bg-[#b45309] dark:bg-[#e8a572]" />
              POR CONFIRMAR
            </span>
            <span className="text-faint font-normal normal-case">{pending.length}</span>
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
                    className={`${tableRowClassV2} px-5 cursor-pointer`}
                    style={gridColsV2(COLS)}
                  >
                    <div className="flex items-center gap-[10px] min-w-0">
                      <span className="w-[30px] h-[30px] shrink-0 rounded-[8px] flex items-center justify-center" style={{ backgroundColor: icon.accent }}>
                        <CatIcon iconKey={icon.iconKey} name={icon.label ?? row.label} color="#fff" size={14} />
                      </span>
                      <p className="text-[13.5px] font-medium text-navy truncate">{row.label}</p>
                    </div>
                    <div>{row.category && <CategoryBadge category={row.category} categories={categories} />}</div>
                    <div>
                      <p className="text-[12.5px] text-muted capitalize">{row.period}</p>
                      {dayDetail && <p className="text-[11px] text-faint capitalize">{dayDetail}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TaxBadgeV2 value={ivaRate} isError={false} />
                      <TaxBadgeV2 value={retRate} isError={false} />
                    </div>
                    <p className="text-right text-[13.5px] font-semibold"><SignedAmount amount={row.amount} /></p>
                    <div className="flex justify-end">
                      {linked ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void onConfirmRow(row); }}
                          title={`Vinculado a ${pickToLabel(pick, contacts)}`}
                          className="inline-flex items-center gap-1.5 bg-[#fef3e2] dark:bg-[#392a13] text-[#b45309] dark:text-[#e8a572] rounded-full px-[11px] py-1 text-[12px] font-semibold whitespace-nowrap hover:bg-[#fce8c8] dark:hover:bg-[#392b13] transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l4 4 10-10" />
                          </svg>
                          Confirmar
                        </button>
                      ) : (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1.5 bg-subtle text-muted rounded-full px-[11px] py-1 text-[12px] font-medium whitespace-nowrap">
                            Sin vincular
                          </span>
                          <p className="text-[11px] text-faint italic mt-1">Vincula un contacto para confirmarlo</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Fila móvil */}
                <div
                  onClick={() => onOpenPending(row)}
                  className="sm:hidden flex items-center gap-[10px] py-[10px] px-5 border-t border-subtle cursor-pointer active:bg-subtle"
                >
                  <span className="w-[32px] h-[32px] shrink-0 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: icon.accent }}>
                    <CatIcon iconKey={icon.iconKey} name={icon.label ?? row.label} color="#fff" size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-navy truncate">{row.label}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {row.category && <CategoryBadge category={row.category} categories={categories} />}
                      <span className="text-[11.5px] text-muted capitalize">{row.period}{dayDetail ? ` · ${dayDetail}` : ""}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-semibold"><SignedAmount amount={row.amount} /></p>
                    {linked ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void onConfirmRow(row); }}
                        title={`Vinculado a ${pickToLabel(pick, contacts)}`}
                        className="mt-1 inline-flex items-center gap-1 bg-[#fef3e2] dark:bg-[#392a13] text-[#b45309] dark:text-[#e8a572] rounded-full px-[9px] py-[3px] text-[11px] font-semibold whitespace-nowrap"
                      >
                        Confirmar
                      </button>
                    ) : (
                      <span className="mt-1 inline-block bg-subtle text-muted rounded-full px-[9px] py-[3px] text-[11px] font-medium whitespace-nowrap">
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

      {confirmed.length === 0 ? (
        <p className="text-sm text-faint py-6 px-5">
          {search.trim() ? "Sin resultados" : "Sin gastos recurrentes confirmados todavía."}
        </p>
      ) : (
        confirmedPageRows.map((row) => {
          const e = row.expense;
          const contact = e.contact_id != null ? contacts.find((c) => c.id === e.contact_id) : undefined;
          const ivaRate = contact?.ivaRate ?? 0;
          const retRate = contact?.retencionRate ?? 0;
          const bothMissing = !contact?.noTax && !(ivaRate > 0) && !(retRate > 0);
          const icon = iconFor(categories, e.category);
          const dayDetail = periodDayDetail(e.period, row.lastDate);
          const isSelected = selectedIds.has(e.id);
          return (
            <div key={e.id}>
              {/* Fila escritorio */}
              <div className="hidden sm:block">
                <div
                  onClick={() => onOpenConfirmed(row)}
                  className={`${tableRowClassV2} px-5 cursor-pointer group ${isSelected ? "bg-subtle" : ""}`}
                  style={gridColsV2(COLS)}
                >
                  <div className="flex items-center gap-[10px] min-w-0">
                    <span className="relative shrink-0 w-[30px] h-[30px]">
                      <span
                        className={`w-[30px] h-[30px] rounded-[8px] items-center justify-center ${isSelected ? "hidden" : "flex group-hover:hidden"}`}
                        style={{ backgroundColor: icon.accent }}
                      >
                        <CatIcon iconKey={icon.iconKey} name={icon.label ?? e.label} color="#fff" size={14} />
                      </span>
                      <label
                        onClick={(ev) => ev.stopPropagation()}
                        className={`${isSelected ? "flex" : "hidden group-hover:flex"} items-center justify-center w-[30px] h-[30px] rounded-[8px] border border-border bg-card cursor-pointer`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSelect(e.id)}
                          className="w-[15px] h-[15px] rounded-[4px] border-border accent-navy focus:ring-navy/20 cursor-pointer"
                        />
                      </label>
                    </span>
                    <p className="text-[13.5px] font-medium text-navy truncate">{e.label}</p>
                  </div>
                  <div>{e.category && <CategoryBadge category={e.category} categories={categories} />}</div>
                  <div>
                    <p className="text-[12.5px] text-muted capitalize">{e.period}</p>
                    {dayDetail && <p className="text-[11px] text-faint capitalize">{dayDetail}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TaxBadgeV2 value={ivaRate} isError={bothMissing} zeroIsExplicit={contact?.noTax} />
                    <TaxBadgeV2 value={retRate} isError={bothMissing} zeroIsExplicit={contact?.noTax} />
                  </div>
                  <p className="text-right text-[13.5px] font-semibold"><SignedAmount amount={e.amount} /></p>
                  <div className="flex justify-end">
                    <span className="inline-flex items-center gap-1.5 text-[#13803a] dark:text-[#7cdfa0] text-[12.5px] font-medium whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] dark:bg-[#7cdfa0]" />
                      Activo
                    </span>
                  </div>
                </div>
              </div>

              {/* Fila móvil */}
              <div
                onClick={() => (selectionMode ? onToggleSelect(e.id) : onOpenConfirmed(row))}
                className={`sm:hidden flex items-center gap-[10px] py-[10px] px-5 border-t border-subtle cursor-pointer active:bg-subtle ${isSelected ? "bg-subtle" : ""}`}
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
                  <span className="w-[32px] h-[32px] shrink-0 rounded-[10px] flex items-center justify-center" style={{ backgroundColor: icon.accent }}>
                    <CatIcon iconKey={icon.iconKey} name={icon.label ?? e.label} color="#fff" size={15} />
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-navy truncate">{e.label}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {e.category && <CategoryBadge category={e.category} categories={categories} />}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-semibold"><SignedAmount amount={e.amount} /></p>
                  <p className="text-[11.5px] text-muted capitalize mt-0.5">{e.period}{dayDetail ? ` · ${dayDetail}` : ""}</p>
                </div>
              </div>
            </div>
          );
        })
      )}
      {confirmed.length > 0 && (
        <div className="hidden sm:block">
          <TablePaginationV2 page={confirmedPage} totalItems={confirmed.length} pageSize={pageSize} onPageChange={onConfirmedPageChange} />
        </div>
      )}
      </div>

      {selectedIds.size > 0 && (
        <BulkActionBarV2
          count={selectedIds.size}
          categories={categories}
          contacts={contacts}
          onClear={exitSelectionMode}
          onSetContact={onBulkContact}
          onSetCategory={onBulkCategory}
          onDelete={onBulkDelete}
        />
      )}
    </div>
  );
}
