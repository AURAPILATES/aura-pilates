/** Agrupación de categorías de gasto por naturaleza económica (sin dependencias de servidor, usable en cliente). */
export type EconomicGroup = "capex" | "personal" | "operational";

export const STARTUP_CATS = new Set([
  "Inversión",
  "Material y maquinaria",
  "Mobiliario",
  "Reforma",
].map((s) => s.toLowerCase()));

export const PERSONAL_CATS = new Set(["Salarios", "Seguridad social"].map((s) => s.toLowerCase()));

const VALID_GROUPS = new Set<string>(["capex", "personal", "operational"]);

/** `override` es el valor explícito guardado en categories.economic_group; si es null,
 * se deriva del nombre (comportamiento legacy, para categorías sin el campo seteado).
 * La comparación por nombre es insensible a mayúsculas/minúsculas: las categorías guardan
 * su `value` en minúsculas o con distinta capitalización según cuándo se crearon. */
export function economicGroupOf(category: string, override?: string | null): EconomicGroup {
  if (override && VALID_GROUPS.has(override)) return override as EconomicGroup;
  const norm = category.toLowerCase();
  if (STARTUP_CATS.has(norm)) return "capex";
  if (PERSONAL_CATS.has(norm)) return "personal";
  return "operational";
}
