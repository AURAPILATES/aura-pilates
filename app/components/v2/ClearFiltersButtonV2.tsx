"use client";

/** Botón de texto transparente para vaciar todos los filtros activos de una tabla V2 de una
 * vez - se muestra cuando hay uno o más filtros aplicados, para no tener que quitarlos de uno
 * en uno entrando en cada control. */
export default function ClearFiltersButtonV2({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1 text-[12.5px] font-medium rounded-[8px] px-2.5 py-[7px] bg-navy/[0.06] hover:bg-navy/[0.1] border border-navy/[0.08] text-muted hover:text-navy transition-colors whitespace-nowrap ${className}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      Eliminar filtros
    </button>
  );
}
