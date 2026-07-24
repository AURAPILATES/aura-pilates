import type { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonV2Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> &
  (
    | { icon: ReactNode; label: string; children?: never }
    | { icon?: undefined; label?: undefined; children: ReactNode }
  );

/** Botón primario del rediseño en prueba (negro, radio 10).
 *
 * Con `icon`+`label` (patrón estándar para acciones "Nuevo/Añadir/Registrar X" en toda la
 * app): en móvil se colapsa a un cuadrado de solo icono (mismo tamaño que IconButtonV2), para
 * no competir por ancho con buscadores/filtros ni partirse en dos líneas; en escritorio
 * muestra icono + texto. Con `children` a secas (p. ej. el "Aplicar" de un popover, que no
 * vive en una barra de herramientas) se comporta como antes, sin colapsar. */
export function PrimaryButtonV2({ className = "", type = "button", icon, label, children, ...props }: PrimaryButtonV2Props) {
  if (icon !== undefined) {
    return (
      <button
        type={type}
        className={`shrink-0 flex items-center justify-center gap-[7px] w-[38px] sm:w-auto h-[38px] sm:h-auto px-0 sm:px-3.5 py-2 text-[12.5px] font-semibold text-app-bg bg-navy rounded-[10px] hover:bg-navy/85 transition-colors disabled:opacity-40 whitespace-nowrap ${className}`}
        {...props}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  }
  return (
    <button
      type={type}
      className={`px-3.5 py-2 text-[12.5px] font-semibold text-app-bg bg-navy rounded-[10px] hover:bg-navy/85 transition-colors disabled:opacity-40 whitespace-nowrap ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Botón de icono secundario (exportar, etc.) - cuadrado con borde, radio 10. */
export function IconButtonV2({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`shrink-0 flex items-center justify-center w-[38px] h-[38px] text-muted border border-border rounded-[10px] bg-card hover:bg-navy/[0.02] transition-colors ${className}`}
      {...props}
    />
  );
}
