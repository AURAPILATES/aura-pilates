import type { CSSProperties } from "react";

/** Estilos compartidos por las tablas "sueltas" del rediseño en prueba: sin caja, cabecera
 * gris uppercase, filas separadas por línea fina, pie con recuento. Cada pantalla define su
 * propia plantilla de columnas (grid-template-columns) vía `gridCols()` porque el número y
 * ancho de columnas varía por tabla. */
export const tableHeadClassV2 =
  "items-center gap-3 pb-[11px] border-b border-border text-[10.5px] tracking-wide uppercase text-faint font-semibold";

export const tableRowClassV2 =
  "items-center gap-3 border-t border-subtle py-[9px] hover:bg-subtle transition-colors";

export const tableGroupClassV2 =
  "flex items-center justify-between gap-2 py-[9px] text-[11.5px] font-bold tracking-wide text-muted";

export const tableFootClassV2 = "px-0.5 py-3.5 text-[12.5px] text-faint";

/** Tarjeta blanca que envuelve cada tabla suelta: sobre el fondo crudo de la app (#f6f5f2)
 * las tablas "flotan" en blanco, como las tarjetas KPI. Los estilos viven en globals.css
 * (.table-card) para poder alternar con el toggle de comparación (.tables-flat en <html>,
 * ver TableStyleToggle) sin duplicar utilidades. El padding horizontal lo aporta la tarjeta
 * (por eso las filas no llevan px propio) para que el inset sea uniforme entre tablas. */
export const tableCardClassV2 = "table-card";

export function gridColsV2(template: string): CSSProperties {
  return { display: "grid", gridTemplateColumns: template };
}
