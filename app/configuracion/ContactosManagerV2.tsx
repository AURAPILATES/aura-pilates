import { useState } from "react";
import type { Category } from "@/lib/categories";
import type { Contact, ContactStats } from "@/app/transacciones/actions";
import { CategoryBadge } from "@/app/transacciones/TransaccionesList";
import Avatar from "@/app/components/Avatar";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import { PrimaryButtonV2 } from "@/app/components/v2/ButtonsV2";
import TaxBadgeV2 from "@/app/components/v2/TaxBadgeV2";
import { tableHeadClassV2, tableRowClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { knownDomain, initials, fmtDate as fmtContactDate } from "./ContactosManager";

const COLS = "2fr 1.3fr .6fr .6fr .7fr .8fr";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  rows: Contact[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  categories: Category[];
  contactStats: Record<number, ContactStats>;
  onRowClick: (id: number) => void;
  onNewContact: () => void;
  onCleanup: () => void;
  cleaning: boolean;
  cleaned: { updated: number; merged: number } | null;
  onRecompute: () => void;
  recomputing: boolean;
  recomputed: number | null;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkSetIva: (rate: number) => void;
  onBulkSetRetencion: (rate: number) => void;
};

/** Barra flotante de acciones masivas, centrada abajo — aparece al seleccionar filas en la
 * tabla de escritorio (checkbox al hover, ver Avatar/checkbox en cada fila). */
function BulkActionBarV2({
  count, onClear, onDelete, onSetIva, onSetRetencion,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onSetIva: (rate: number) => void;
  onSetRetencion: (rate: number) => void;
}) {
  const [mode, setMode] = useState<"idle" | "iva" | "retencion" | "delete">("idle");
  const [draft, setDraft] = useState("");

  function submitRate() {
    const v = parseFloat(draft.replace(",", ".")) || 0;
    if (mode === "iva") onSetIva(v);
    if (mode === "retencion") onSetRetencion(v);
    setMode("idle");
    setDraft("");
  }

  return (
    <div className="fixed left-1/2 bottom-6 -translate-x-1/2 z-30 flex items-center gap-2 bg-[#18181b] text-white rounded-[14px] shadow-lg pl-4 pr-2 py-2">
      <span className="text-[13px] font-medium whitespace-nowrap">{count} seleccionado{count !== 1 ? "s" : ""}</span>
      <div className="w-px h-5 bg-white/15 shrink-0" />
      {mode === "iva" || mode === "retencion" ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-white/60 whitespace-nowrap">{mode === "iva" ? "IVA" : "IRPF"} %</span>
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitRate(); if (e.key === "Escape") setMode("idle"); }}
            className="w-14 px-2 py-1 text-[13px] text-[#18181b] rounded-[7px] focus:outline-none"
          />
          <button type="button" onClick={submitRate} className="text-[12px] font-semibold text-[#18181b] bg-white hover:bg-white/85 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">
            Aplicar
          </button>
          <button type="button" onClick={() => setMode("idle")} className="text-white/50 hover:text-white text-[12px] px-1">
            Cancelar
          </button>
        </div>
      ) : mode === "delete" ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-white/70 whitespace-nowrap">¿Eliminar {count}?</span>
          <button type="button" onClick={onDelete} className="text-[12px] font-semibold text-white bg-[#dc2626] hover:bg-[#dc2626]/85 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">
            Sí, eliminar
          </button>
          <button type="button" onClick={() => setMode("idle")} className="text-white/50 hover:text-white text-[12px] px-1">
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMode("iva")} className="text-[12.5px] font-medium text-white/85 hover:text-white hover:bg-white/10 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">
            Cambiar IVA
          </button>
          <button type="button" onClick={() => setMode("retencion")} className="text-[12.5px] font-medium text-white/85 hover:text-white hover:bg-white/10 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">
            Cambiar IRPF
          </button>
          <button type="button" onClick={() => setMode("delete")} className="text-[12.5px] font-medium text-[#f87171] hover:text-white hover:bg-[#dc2626]/30 rounded-[7px] px-2.5 py-1.5 transition-colors whitespace-nowrap">
            Eliminar
          </button>
        </div>
      )}
      <button type="button" onClick={onClear} title="Cancelar selección" className="ml-1 w-6 h-6 flex items-center justify-center shrink-0 text-white/40 hover:text-white transition-colors">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

export default function ContactosManagerV2({
  search, onSearchChange, rows, totalCount, page, pageSize, onPageChange,
  categories, contactStats, onRowClick, onNewContact, onCleanup, cleaning, cleaned, onRecompute, recomputing, recomputed,
  selectedIds, onToggleSelect, onClearSelection, onBulkDelete, onBulkSetIva, onBulkSetRetencion,
}: Props) {
  return (
    <div>
      <div className="flex items-center gap-[10px] flex-wrap">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar contacto…" className="flex-1 min-w-[160px]" />
        <button
          type="button"
          onClick={onCleanup}
          disabled={cleaning}
          title="Vuelve a limpiar los conceptos ya guardados quitando códigos de operación variables, para que coincidan de forma estable"
          className="flex items-center gap-[7px] border border-[#e6e6ea] rounded-[10px] px-[13px] py-2.5 text-[13.5px] font-medium text-[#3f3f46] bg-white hover:bg-[#18181b]/[0.02] transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {cleaning ? "Limpiando…" : cleaned !== null ? `${cleaned.updated} limpiados, ${cleaned.merged} fusionados` : "Limpiar conceptos"}
        </button>
        <button
          type="button"
          onClick={onRecompute}
          disabled={recomputing}
          title="Vuelve a calcular Contacto a partir de Concepto + Más datos, cruzando con los contactos guardados"
          className="flex items-center gap-[7px] border border-[#e6e6ea] rounded-[10px] px-[13px] py-2.5 text-[13.5px] font-medium text-[#3f3f46] bg-white hover:bg-[#18181b]/[0.02] transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 11a8 8 0 0 0-14-4M4 5v3h3" /><path d="M4 13a8 8 0 0 0 14 4M20 19v-3h-3" />
          </svg>
          {recomputing ? "Recalculando…" : recomputed !== null ? `${recomputed} actualizados` : "Recalcular"}
        </button>
        <PrimaryButtonV2 onClick={onNewContact} className="flex items-center gap-[7px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Nuevo contacto
        </PrimaryButtonV2>
      </div>

      <div className="mt-[24px]">
        <div className="hidden sm:block">
          <div className={tableHeadClassV2} style={gridColsV2(COLS)}>
            <span>Nombre</span>
            <span>Categoría</span>
            <span>IVA</span>
            <span>IRPF</span>
            <span>Movim.</span>
            <span className="text-right">Últ. mov.</span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-[#a1a1aa] text-sm">Ningún contacto coincide con la búsqueda.</div>
        ) : (
          rows.map((c) => {
            const stats = contactStats[c.id];
            const lastDate = stats?.latest?.[0]?.date;
            const bothMissing = !(c.ivaRate > 0) && !(c.retencionRate > 0);
            const isSelected = selectedIds.has(c.id);
            return (
              <div key={c.id}>
                {/* Fila escritorio */}
                <div className="hidden sm:block">
                  <div
                    onClick={() => onRowClick(c.id)}
                    className={`${tableRowClassV2} cursor-pointer group`}
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
                            className="w-[17px] h-[17px] rounded-[5px] border-[#d4d4d8] text-[#18181b] focus:ring-[#18181b]/20 cursor-pointer"
                          />
                        </label>
                      </span>
                      <p className="text-[13.5px] font-medium text-[#18181b] truncate">{c.label}</p>
                    </div>
                    <div><CategoryBadge category={c.category} categories={categories} /></div>
                    <div><TaxBadgeV2 value={c.ivaRate} isError={bothMissing} /></div>
                    <div><TaxBadgeV2 value={c.retencionRate} isError={bothMissing} /></div>
                    <p className="text-[13px] font-semibold text-[#18181b]">{stats?.count ?? "—"}</p>
                    <p className="text-right text-[12.5px] text-[#71717a]">{lastDate ? fmtContactDate(lastDate) : "—"}</p>
                  </div>
                </div>

                {/* Fila móvil */}
                <div
                  onClick={() => onRowClick(c.id)}
                  className="sm:hidden flex items-center gap-[10px] py-[10px] border-t border-[#f4f4f4] cursor-pointer active:bg-[#fafafb]"
                >
                  <Avatar seed={c.label} initials={initials(c.label)} logoDomain={knownDomain(c.label)} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#18181b] truncate">{c.label}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <CategoryBadge category={c.category} categories={categories} />
                      <TaxBadgeV2 value={c.ivaRate} isError={bothMissing} />
                      <TaxBadgeV2 value={c.retencionRate} isError={bothMissing} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold text-[#18181b]">{stats?.count ?? "—"}</p>
                    <p className="text-[11px] text-[#a1a1aa]">{lastDate ? fmtContactDate(lastDate) : "—"}</p>
                  </div>
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
          onClear={onClearSelection}
          onDelete={onBulkDelete}
          onSetIva={onBulkSetIva}
          onSetRetencion={onBulkSetRetencion}
        />
      )}
    </div>
  );
}
