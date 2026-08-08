import type { CSSProperties } from "react";

/** Estilos compartidos por las tablas "sueltas" del rediseño en prueba: sin caja, cabecera
 * gris uppercase, filas separadas por línea fina, pie con recuento. Cada pantalla define su
 * propia plantilla de columnas (grid-template-columns) vía `gridCols()` porque el número y
 * ancho de columnas varía por tabla. */
export const tableHeadClassV2 =
  "grid-row-v2 items-center gap-3 py-[9px] bg-[#fafaf8] dark:bg-white/[0.03] border-b border-border text-[10.5px] tracking-wide uppercase text-faint font-semibold";

export const tableRowClassV2 =
  "grid-row-v2 items-center gap-3 border-t border-subtle py-[10px] hover:bg-subtle transition-colors";

export const tableGroupClassV2 =
  "flex items-center justify-between gap-2 py-[7px] text-[11.5px] font-semibold tracking-wide text-muted";

export const tableFootClassV2 = "px-0.5 py-3 text-[12.5px] text-faint";

/** Envoltorio de cada tabla suelta, estilo "Ancho": sin caja propia, se apoya directamente
 * en el panel blanco del contenido. Los estilos viven en globals.css (.table-card). */
export const tableCardClassV2 = "table-card";

/** Envuelve cada valor "Nfr" suelto (fuera de minmax()/repeat()) en minmax(0, Nfr). Cada fila
 * es su propio grid (no hay subgrid), así que sin esto el contenido que no rompe línea
 * (badges, texto con whitespace-nowrap) empuja cada fila a anchuras de columna distintas según
 * qué filas estén visibles - columnas que "saltan" al aplicar un filtro. */
function fixedFrTemplate(template: string): string {
  let depth = 0;
  return template.replace(/\(|\)|[.\d]+fr\b/g, (token) => {
    if (token === "(") { depth++; return token; }
    if (token === ")") { depth--; return token; }
    return depth === 0 ? `minmax(0,${token})` : token;
  });
}

export function gridColsV2(template: string): CSSProperties {
  return { display: "grid", gridTemplateColumns: fixedFrTemplate(template) };
}
