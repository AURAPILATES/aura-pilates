/** Agrupación de categorías de gasto por naturaleza económica (sin dependencias de servidor, usable en cliente). */
export type EconomicGroup = "capex" | "personal" | "operational";

export const STARTUP_CATS = new Set([
  "Inversión",
  "Material y maquinaria",
  "Mobiliario",
  "Reforma",
]);

export const PERSONAL_CATS = new Set(["Salarios", "Seguridad social"]);

export function economicGroupOf(category: string): EconomicGroup {
  if (STARTUP_CATS.has(category)) return "capex";
  if (PERSONAL_CATS.has(category)) return "personal";
  return "operational";
}
