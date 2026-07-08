import type { ReactNode } from "react";

/** Primitivos compartidos del estilo "Factorial" — aplicado solo en móvil (ver
 * TransaccionesMobileV2 y sucesivos). Cajas blancas muy redondeadas con sombra suave sobre
 * fondo gris, iconos en cuadrado redondeado de color, botón circular de flecha por fila. */

export const MOBILE_V2_BG = "#f4f4f6";

export function MobileCardV2({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`bg-white rounded-[20px] overflow-hidden ${className}`}
      style={{ boxShadow: "0 1px 2px rgba(24,24,27,.04), 0 6px 16px -8px rgba(24,24,27,.10)" }}
    >
      {children}
    </div>
  );
}

export function MobileIconSquircleV2({ children, bg, size = 44 }: { children: ReactNode; bg: string; size?: number }) {
  return (
    <div
      className="shrink-0 rounded-[14px] flex items-center justify-center"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      {children}
    </div>
  );
}

export function MobileChevronButtonV2({ onClick }: { onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 w-8 h-8 rounded-full bg-[#f0f0f2] text-[#71717a] flex items-center justify-center"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

export function MobileFilterPillV2({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-medium border transition-colors ${
        active ? "border-[#18181b] text-[#18181b] bg-white shadow-sm" : "border-[#e5e5e7] text-[#71717a] bg-white"
      }`}
    >
      {children}
    </button>
  );
}

export function MobileSearchBarV2({ value, onChange, placeholder = "Buscar" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a1a1aa]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7.5" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-11 pr-4 py-3 rounded-[14px] border border-[#e5e5e7] bg-white text-[15px] text-[#18181b] placeholder:text-[#a1a1aa] outline-none focus:border-[#18181b]/30"
      />
    </div>
  );
}
