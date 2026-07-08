import type { CSSProperties } from "react";

/** Estilos compartidos por las tablas "sueltas" del rediseño en prueba: sin caja, cabecera
 * gris uppercase, filas separadas por línea fina, pie con recuento. Cada pantalla define su
 * propia plantilla de columnas (grid-template-columns) vía `gridCols()` porque el número y
 * ancho de columnas varía por tabla. */
export const tableHeadClassV2 =
  "items-center gap-3 pb-[11px] border-b border-[#ececef] text-[10.5px] tracking-wide uppercase text-[#a1a1aa] font-semibold";

export const tableRowClassV2 =
  "items-center gap-3 border-t border-[#f4f4f4] py-[9px] hover:bg-[#fafafb] transition-colors";

export const tableGroupClassV2 =
  "items-center justify-between gap-2 py-[9px] text-[11.5px] font-bold tracking-wide text-[#71717a]";

export const tableFootClassV2 = "px-0.5 py-3.5 text-[12.5px] text-[#a1a1aa]";

export function gridColsV2(template: string): CSSProperties {
  return { display: "grid", gridTemplateColumns: template };
}
