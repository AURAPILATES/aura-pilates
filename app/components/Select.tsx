import type { SelectHTMLAttributes } from "react";

/** Select compartido por toda la app: mismo contorno, radio, tipografía y flecha
 * (filtros de tablas, formularios de Transacciones/Recurrentes/Horario/Analítica…). */
export default function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select
        className="w-full appearance-none text-sm border border-navy/[0.12] rounded-lg pl-3 pr-8 py-2 bg-white text-navy outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-navy/25 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-navy/40"
        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
