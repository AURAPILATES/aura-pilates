import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & { variant?: "classic" | "v2" | "bare" };

/** Select compartido por toda la app: mismo contorno, radio, tipografía y flecha
 * (filtros de tablas, formularios de Transacciones/Recurrentes/Horario/Analítica…).
 * `variant="v2"` aplica el look del rediseño en prueba sin duplicar el componente.
 * `variant="bare"` quita el propio borde/fondo para ir dentro de un <Field> (el fieldset ya
 * pone el borde). */
export default function Select({ className = "", children, variant = "classic", ...props }: Props) {
  const selectCls =
    variant === "v2"
      ? "w-full appearance-none text-[13.5px] border border-border rounded-[10px] pl-3 pr-8 py-2 bg-card text-navy outline-none focus:ring-2 focus:ring-navy/10 hover:border-navy/20 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      : variant === "bare"
      ? "w-full appearance-none border-0 pr-6 bg-transparent text-navy outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      : "w-full appearance-none text-sm border border-navy/[0.12] rounded-lg pl-3 pr-8 py-2 bg-card text-navy outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 hover:border-navy/25 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-colors";
  return (
    <div className={`relative ${className}`}>
      <select className={selectCls} {...props}>
        {children}
      </select>
      <svg
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${variant === "bare" ? "right-0 text-navy/40" : "right-3"} ${variant === "v2" ? "text-faint" : "text-navy/40"}`}
        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
