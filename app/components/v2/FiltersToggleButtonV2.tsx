"use client";

/** Botón "Filtros" (solo móvil) que abre/cierra el panel de filtros secundarios de una
 * toolbar V2. `active` lo resalta cuando hay algún filtro de ese panel aplicado, aunque
 * esté cerrado. */
export default function FiltersToggleButtonV2({
  open,
  active,
  onClick,
}: {
  open: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Filtros"
      className={`sm:hidden shrink-0 flex items-center justify-center w-9 h-9 rounded-[10px] border transition-colors relative ${
        open ? "border-navy bg-navy text-app-bg" : "border-border bg-card text-muted"
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
      {active && !open && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#b45309] dark:bg-[#e8a572] border border-white" />
      )}
    </button>
  );
}
