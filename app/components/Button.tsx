import type { ButtonHTMLAttributes } from "react";

/** Botón primario compartido por toda la app: mismo color, radio, tipografía y estados
 * (Guardar, Añadir, Confirmar…). Para variantes con icono, añade `flex items-center gap-2`
 * vía className. */
export default function Button({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`px-4 py-2.5 text-sm font-semibold text-white bg-navy rounded-lg hover:bg-navy/85 transition-colors disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}
