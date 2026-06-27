/** Agrupación de categorías de gasto por naturaleza económica (sin dependencias de servidor, usable en cliente). */
export type EconomicGroup = "capex" | "personal" | "operational";

export const STARTUP_CATS = new Set([
  "Inversión",
  "Material y maquinaria",
  "Mobiliario",
  "Reforma",
]);

export const PERSONAL_CATS = new Set(["Salarios", "Seguridad social"]);

const VALID_GROUPS = new Set<string>(["capex", "personal", "operational"]);

/** `override` es el valor explícito guardado en categories.economic_group; si es null,
 * se deriva del nombre (comportamiento legacy, para categorías sin el campo seteado). */
export function economicGroupOf(category: string, override?: string | null): EconomicGroup {
  if (override && VALID_GROUPS.has(override)) return override as EconomicGroup;
  if (STARTUP_CATS.has(category)) return "capex";
  if (PERSONAL_CATS.has(category)) return "personal";
  return "operational";
}
