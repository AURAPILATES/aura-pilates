"use client";

/** Botón de texto transparente para vaciar todos los filtros activos de una tabla V2 de una
 * vez - se muestra solo cuando hay 2 o más filtros aplicados a la vez (una tabla con un único
 * filtro ya tiene su propio "quitar" en el propio control). */
export default function ClearFiltersButtonV2({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-navy transition-colors whitespace-nowrap ${className}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      Eliminar filtros
    </button>
  );
}
