import { useState } from "react";
import { sortCategoriesHierarchical, categoryDisplayLabel, type Category } from "@/lib/categories";
import type { Contact, ContactStats } from "@/app/transacciones/actions";
import { CategoryBadge } from "@/app/transacciones/TransaccionesList";
import Avatar from "@/app/components/Avatar";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import { PrimaryButtonV2 } from "@/app/components/v2/ButtonsV2";
import HeaderPortal from "@/app/components/HeaderPortal";
import { CONTACT_GROUP_ORDER, CONTACT_GROUP_LABELS, type ContactGroup } from "@/lib/contactGroups";
import TaxBadgeV2 from "@/app/components/v2/TaxBadgeV2";
import { tableHeadClassV2, tableRowClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { knownDomain, initials, fmtDate as fmtContactDate } from "./ContactosManager";

const COLS = "2fr 1.3fr .6fr .6fr 1.3fr";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  groupFilter: "all" | ContactGroup;
  onGroupFilterChange: (g: "all" | ContactGroup) => void;
  groupCounts: Record<ContactGroup, number>;
  rows: Contact[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  categories: Category[];
  contactStats: Record<number, ContactStats>;
  onRowClick: (id: number) => void;
  duplicateMatchOf: Map<number, number>;
  onOpenDuplicate: (aId: number, bId: number) => void;
  onViewTransactions: (contact: Contact) => void;
  onNewContact: () => void;
  onCleanup: () => void;
  cleaning: boolean;
  cleaned: { updated: number; merged: number } | null;
  onRecompute: () => void;
  recomputing: boolean;
  recomputed: number | null;
  pendingRecomputeCount: number;
  pendingCleanupCount: number;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkSetIva: (rate: number) => void;
  onBulkSetRetencion: (rate: number) => void;
  onBulkSetCategory: (category: string | null) => void;
};

const IVA_RATES = [21, 10, 4];
const IRPF_RATES = [15, 7, 19];

/** Aviso de posible contacto duplicado (mismo nombre parecido o mismos conceptos bancarios,
 * ver lib/duplicateContacts.ts). Al tocarlo abre el drawer de comparación en vez del detalle
 * normal del contacto. */
function DuplicateBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="shrink-0 inline-flex items-center gap-1 bg-warning/10 text-warning border border-warning/25 rounded-full px-2 py-[2px] text-[10.5px] font-semibold whitespace-nowrap hover:bg-warning/15 transition-colors"
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      Posible duplicado
    </button>
  );
}

/** Barra flotante de acciones masivas. En escritorio la selección se activa con el checkbox
 * al hover; en móvil con el modo selección (tocar una fila la marca). Misma UI que las barras
 * de Movimientos/Recurrentes: 94% del ancho y pegada abajo en móvil, compacta en escritorio. */
function BulkActionBarV2({
  count, categories, onClear, onDelete, onSetIva, onSetRetencion, onSetCategory,
}: {
  count: number;
  categories: Category[];
  onClear: () => void;
  onDelete: () => void;
  onSetIva: (rate: number) => void;
  onSetRetencion: (rate: number) => void;
  onSetCategory: (category: string | null) => void;
}) {
  const [mode, setMode] = useState<"idle" | "iva" | "retencion" | "category" | "delete">("idle");
  const [rateDraft, setRateDraft] = useState("");
  const [catDraft, setCatDraft] = useState("");

  function submitRate() {
    if (rateDraft === "") return;
    const v = parseFloat(rateDraft) || 0;
    if (mode === "iva") onSetIva(v);
    if (mode === "retencion") onSetRetencion(v);
    setMode("idle");
    setRateDraft("");
  }
  function submitCategory() {
    if (!catDraft) return;
    onSetCategory(catDraft === "__null__" ? null : catDraft);
    setMode("idle");
    setCatDraft("");
  }

  const selectCls = "text-[13px] rounded-[7px] px-2 py-1 bg-app-bg/10 text-app-bg border border-app-bg/20 outline-none focus:border-app-bg/40 max-w-[150px] cursor-pointer";
  const applyCls = "text-[12px] font-semibold text-navy bg-app-bg hover:bg-app-bg/85 disabled:opacity-40 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap";

  return (
    <div className="flex fixed z-30 items-center justify-between gap-2 bg-navy text-app-bg shadow-lg pl-4 pr-2 py-2 left-1/2 -translate-x-1/2 bottom-[6px] w-[94%] rounded-[6px] sm:bottom-6 sm:w-auto sm:rounded-[14px]">
      <div className="flex items-center gap-2 min-w-0 overflow-x-auto scrollbar-none">
        <span className="text-[13px] font-medium whitespace-nowrap">{count} sel.<span className="hidden sm:inline">eccionado{count !== 1 ? "s" : ""}</span></span>
        <div className="w-px h-5 bg-app-bg/15 shrink-0" />
        {mode === "iva" || mode === "retencion" ? (
          <div className="flex items-center gap-1.5">
            <select autoFocus value={rateDraft} onChange={(e) => setRateDraft(e.target.value)} className={selectCls}>
              <option value="" disabled className="text-navy">{mode === "iva" ? "IVA…" : "IRPF…"}</option>
              <option value="0" className="text-navy">{mode === "iva" ? "Sin IVA" : "Sin IRPF"}</option>
              {(mode === "iva" ? IVA_RATES : IRPF_RATES).map((r) => (
                <option key={r} value={r} className="text-navy">{r}%</option>
              ))}
            </select>
            <button type="button" onClick={submitRate} disabled={rateDraft === ""} className={applyCls}>Aplicar</button>
            <button type="button" onClick={() => setMode("idle")} className="text-app-bg/50 hover:text-app-bg text-[12px] px-1">Cancelar</button>
          </div>
        ) : mode === "category" ? (
          <div className="flex items-center gap-1.5">
            <select autoFocus value={catDraft} onChange={(e) => setCatDraft(e.target.value)} className={selectCls}>
              <option value="" disabled className="text-navy">Categoría…</option>
              <option value="__null__" className="text-navy">Sin categoría</option>
              {sortCategoriesHierarchical(categories).map((c) => (
                <option key={c.value} value={c.value} className="text-navy">{categoryDisplayLabel(c, categories)}</option>
              ))}
            </select>
            <button type="button" onClick={submitCategory} disabled={!catDraft} className={applyCls}>Aplicar</button>
            <button type="button" onClick={() => setMode("idle")} className="text-app-bg/50 hover:text-app-bg text-[12px] px-1">Cancelar</button>
          </div>
        ) : mode === "delete" ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-app-bg/70 whitespace-nowrap">¿Eliminar {count}?</span>
            <button type="button" onClick={onDelete} className="text-[12px] font-semibold text-white bg-[#dc2626] dark:bg-[#dd7e7e] hover:bg-[#dc2626]/85 dark:hover:bg-[#dd7e7e]/85 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">
              Sí, eliminar
            </button>
            <button type="button" onClick={() => setMode("idle")} className="text-app-bg/50 hover:text-app-bg text-[12px] px-1">Cancelar</button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setMode("iva")} className="text-[12.5px] font-medium text-app-bg/85 hover:text-app-bg hover:bg-app-bg/10 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">IVA</button>
            <button type="button" onClick={() => setMode("retencion")} className="text-[12.5px] font-medium text-app-bg/85 hover:text-app-bg hover:bg-app-bg/10 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">IRPF</button>
            <button type="button" onClick={() => setMode("category")} className="text-[12.5px] font-medium text-app-bg/85 hover:text-app-bg hover:bg-app-bg/10 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">Categoría</button>
            <button type="button" onClick={() => setMode("delete")} className="text-[12.5px] font-medium text-[#f87171] hover:text-white hover:bg-[#dc2626]/30 dark:hover:bg-[#dd7e7e]/30 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">Eliminar</button>
          </div>
        )}
      </div>
      <button type="button" onClick={onClear} title="Cancelar selección" className="w-6 h-6 flex items-center justify-center shrink-0 text-app-bg/40 hover:text-app-bg transition-colors">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

export default function ContactosManagerV2({
  search, onSearchChange, groupFilter, onGroupFilterChange, groupCounts, rows, totalCount, page, pageSize, onPageChange,
  categories, contactStats, onRowClick, duplicateMatchOf, onOpenDuplicate, onViewTransactions, onNewContact, onCleanup, cleaning, cleaned, onRecompute, recomputing, recomputed,
  pendingRecomputeCount, pendingCleanupCount,
  selectedIds, onToggleSelect, onClearSelection, onBulkDelete, onBulkSetIva, onBulkSetRetencion, onBulkSetCategory,
}: Props) {
  // Modo selección solo para móvil (en escritorio se usa el checkbox al hover): tocar una
  // fila la marca en vez de abrir su detalle.
  const [selectionMode, setSelectionMode] = useState(false);
  function exitSelectionMode() {
    setSelectionMode(false);
    onClearSelection();
  }

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar contacto…" className="flex-1 min-w-[160px]" />
        {rows.length > 0 && (
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
        <HeaderPortal>
          <PrimaryButtonV2
            onClick={onNewContact}
            label="Nuevo contacto"
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
          />
        </HeaderPortal>
      </div>

      <div className="mt-3">
        <FilterPillGroupV2
          variant="segmented"
          active={groupFilter}
          onChange={onGroupFilterChange}
          options={[
            { key: "all" as const, label: "Todos" },
            ...CONTACT_GROUP_ORDER.map((g) => ({ key: g, label: CONTACT_GROUP_LABELS[g], count: groupCounts[g] })),
          ]}
        />
      </div>

      {(pendingCleanupCount > 0 || pendingRecomputeCount > 0) && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {pendingCleanupCount > 0 && (
            <button
              type="button"
              onClick={onCleanup}
              disabled={cleaning}
              title="Vuelve a limpiar los conceptos ya guardados quitando códigos de operación variables, para que coincidan de forma estable"
              className="inline-flex items-center gap-[7px] bg-[#fef3e2] dark:bg-[#392a13] text-[#b45309] dark:text-[#e8a572] border border-[#f6dcb8] dark:border-[#6f522a] rounded-full px-3 py-[5px] text-[12.5px] font-medium disabled:opacity-50"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17v.5" />
              </svg>
              {cleaning ? "Limpiando…" : cleaned !== null ? `${cleaned.updated} limpiados, ${cleaned.merged} fusionados` : `${pendingCleanupCount} conceptos por limpiar`}
            </button>
          )}
          {pendingRecomputeCount > 0 && (
            <button
              type="button"
              onClick={onRecompute}
              disabled={recomputing}
              title="Vuelve a calcular Contacto a partir de Concepto + Más datos, cruzando con los contactos guardados"
              className="inline-flex items-center gap-[7px] bg-[#fef3e2] dark:bg-[#392a13] text-[#b45309] dark:text-[#e8a572] border border-[#f6dcb8] dark:border-[#6f522a] rounded-full px-3 py-[5px] text-[12.5px] font-medium disabled:opacity-50"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17v.5" />
              </svg>
              {recomputing ? "Recalculando…" : recomputed !== null ? `${recomputed} actualizados` : `${pendingRecomputeCount} movimientos con contacto desactualizado`}
            </button>
          )}
        </div>
      )}

      <div className={`mt-[24px] -mx-4 sm:-mx-6 ${tableCardClassV2} overflow-hidden`}>
        <div className="hidden sm:block">
          <div className={`${tableHeadClassV2} px-5`} style={gridColsV2(COLS)}>
            <span>Nombre</span>
            <span>Categoría</span>
            <span>IVA</span>
            <span>IRPF</span>
            <span className="flex items-center justify-end gap-3 text-right">
              <span>Movim.</span>
              <span>Últ. mov.</span>
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 px-5 text-center text-faint text-sm">Ningún contacto coincide con la búsqueda.</div>
        ) : (
          rows.map((c) => {
            const stats = contactStats[c.id];
            const lastDate = stats?.latest?.[0]?.date;
            const bothMissing = !c.noTax && !(c.ivaRate > 0) && !(c.retencionRate > 0);
            const isSelected = selectedIds.has(c.id);
            const duplicateId = duplicateMatchOf.get(c.id) ?? null;
            return (
              <div key={c.id}>
                {/* Fila escritorio */}
                <div className="hidden sm:block">
                  <div
                    onClick={() => onRowClick(c.id)}
                    className={`${tableRowClassV2} px-5 cursor-pointer group`}
                    style={gridColsV2(COLS)}
                  >
                    <div className="flex items-center gap-[11px] min-w-0">
                      <span className="relative shrink-0 w-[30px] h-[30px]">
                        <span className={isSelected ? "hidden" : "block group-hover:hidden"}>
                          <Avatar seed={c.label} initials={initials(c.label)} logoDomain={knownDomain(c.label)} size={30} />
                        </span>
                        <label
                          onClick={(e) => e.stopPropagation()}
                          className={`${isSelected ? "flex" : "hidden group-hover:flex"} items-center justify-center w-[30px] h-[30px] cursor-pointer`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleSelect(c.id)}
                            className="w-[17px] h-[17px] rounded-[5px] border-border accent-navy focus:ring-navy/20 cursor-pointer"
                          />
                        </label>
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-[13.5px] font-medium text-navy truncate">{c.label}</p>
                          {duplicateId != null && (
                            <DuplicateBadge onClick={() => onOpenDuplicate(c.id, duplicateId)} />
                          )}
                        </div>
                        {c.patterns.length > 0 && (
                          <p className="text-[11.5px] text-faint truncate">{c.patterns.join(", ")}</p>
                        )}
                      </div>
                    </div>
                    <div><CategoryBadge category={c.category} categories={categories} /></div>
                    <div><TaxBadgeV2 value={c.ivaRate} isError={bothMissing} zeroIsExplicit={c.noTax} /></div>
                    <div><TaxBadgeV2 value={c.retencionRate} isError={bothMissing} zeroIsExplicit={c.noTax} /></div>
                    <div className="flex items-center justify-end gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] text-faint whitespace-nowrap shrink-0">{stats?.count ?? 0} trx</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onViewTransactions(c); }}
                          title={`Ver movimientos de "${c.label}"`}
                          className="shrink-0 text-border hover:text-muted transition-colors"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-3.8-3.8" /></svg>
                        </button>
                      </div>
                      <p className="text-[12.5px] text-muted whitespace-nowrap">{lastDate ? fmtContactDate(lastDate) : "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Fila móvil */}
                <div
                  onClick={() => (selectionMode ? onToggleSelect(c.id) : onRowClick(c.id))}
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
                    <Avatar seed={c.label} initials={initials(c.label)} logoDomain={knownDomain(c.label)} size={32} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-navy truncate">{c.label}</p>
                    {c.patterns.length > 0 && (
                      <p className="text-[11.5px] text-faint truncate">{c.patterns.join(", ")}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {duplicateId != null && (
                        <DuplicateBadge onClick={() => onOpenDuplicate(c.id, duplicateId)} />
                      )}
                      <CategoryBadge category={c.category} categories={categories} />
                      {bothMissing ? (
                        <TaxBadgeV2 value={0} isError />
                      ) : c.noTax ? (
                        <span className="inline-flex items-center bg-subtle text-muted rounded-[6px] px-[7px] py-[2px] text-[11px] font-medium whitespace-nowrap">
                          Sin IVA ni retenciones
                        </span>
                      ) : (
                        <span className="inline-flex items-center bg-subtle text-muted rounded-[6px] px-[7px] py-[2px] text-[11px] font-medium whitespace-nowrap">
                          {[c.ivaRate > 0 ? `IVA ${c.ivaRate}%` : null, c.retencionRate > 0 ? `IRPF ${c.retencionRate}%` : null]
                            .filter(Boolean)
                            .join(" | ")}
                        </span>
                      )}
                    </div>
                  </div>
                  {!selectionMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewTransactions(c); }}
                      title={`Ver movimientos de "${c.label}"`}
                      className="shrink-0 text-border hover:text-muted transition-colors p-1"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-3.8-3.8" /></svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        {rows.length > 0 && (
          <TablePaginationV2 page={page} totalItems={totalCount} pageSize={pageSize} onPageChange={onPageChange} />
        )}
      </div>

      {selectedIds.size > 0 && (
        <BulkActionBarV2
          count={selectedIds.size}
          categories={categories}
          onClear={exitSelectionMode}
          onDelete={onBulkDelete}
          onSetIva={onBulkSetIva}
          onSetRetencion={onBulkSetRetencion}
          onSetCategory={onBulkSetCategory}
        />
      )}
    </div>
  );
}
