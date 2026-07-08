import type { ButtonHTMLAttributes } from "react";

/** Botón primario del rediseño en prueba (negro, radio 10). Para variantes con icono, añade
 * `flex items-center gap-2` vía className, como en Button.tsx. */
export function PrimaryButtonV2({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`px-3.5 py-2 text-[11.5px] font-semibold text-white bg-[#18181b] rounded-[10px] hover:bg-[#18181b]/85 transition-colors disabled:opacity-40 whitespace-nowrap ${className}`}
      {...props}
    />
  );
}

/** Botón de icono secundario (exportar, etc.) — cuadrado con borde, radio 10. */
export function IconButtonV2({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`shrink-0 flex items-center justify-center w-[38px] h-[38px] text-[#52525b] border border-[#e6e6ea] rounded-[10px] bg-white hover:bg-[#18181b]/[0.02] transition-colors ${className}`}
      {...props}
    />
  );
}
