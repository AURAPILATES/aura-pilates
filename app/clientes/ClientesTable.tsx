// Helpers y tipos de cliente reutilizados por la tabla de clientes (ClientesEstado), las fichas
// (MemberDrawer, CustomerDrawer), el historial de compras y Analítica. La tabla antigua y su
// vista V2 se eliminaron; este módulo quedó solo con los helpers puros que siguen en uso.
import type { StripeCustomer } from "@/lib/stripeCustomers";

export type CustomerRow = StripeCustomer & { daysSinceLastSub?: number | null; daysSinceLastPack?: number | null; lastPackProduct?: string | null; lastSubProduct?: string | null; isActive?: boolean; isNew?: boolean; isFamily?: boolean; paymentErrorAcked?: boolean };
export type ClientesTableHandle = { openCustomer: (id: string) => void };

export type SortKey = "totalSpent" | "lastPaymentDate" | "name";
export type SortDir = "asc" | "desc";
export type Filter  = "all" | "recurring" | "occasional" | "error" | "delayed" | "family";

export function fmtDate(d: string) {
  return d.split("-").reverse().join("/");
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Fecha larga ("3 marzo 2026") para vistas de detalle con espacio de sobra (fichas, drawers).
// No usar en columnas de tabla estrechas: usar fmtDate ahí.
export function fmtDateLong(d: string) {
  const [y, m, day] = d.split("-");
  return `${Number(day)} ${MESES[Number(m) - 1]} ${y}`;
}

export function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr + "T00:00:00").getTime()) / 86400000);
  if (days < 7)   return `Hace ${days} día${days !== 1 ? "s" : ""}`;
  if (days < 30)  return `Hace ${Math.round(days / 7)} semana${Math.round(days / 7) !== 1 ? "s" : ""}`;
  const months = Math.round((days / 30) * 2) / 2;
  if (days < 365) return `Hace ${String(months).replace(".", ",")} mes${months !== 1 ? "es" : ""}`;
  const years = Math.round((days / 365) * 2) / 2;
  return `Hace ${String(years).replace(".", ",")} año${years !== 1 ? "s" : ""}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

export function paymentExpiry(p: { category: string; inferredProduct: string; date: string }): string | null {
  if (p.category === "Suscripción") return addDays(p.date, 30);
  if (p.inferredProduct === "Pack Benvinguda") return addDays(p.date, 15);
  if (p.inferredProduct === "Pack 4 clases" || p.inferredProduct === "Pack 8 clases") return addDays(p.date, 90);
  return null;
}

export type ClientStatus = "baja" | "sinpagar" | "caducado" | "porvencer" | "ok";

export function clientStatus(c: CustomerRow): { status: ClientStatus; days: number | null } {
  if (c.isRecurring) {
    const d = c.daysSinceLastSub ?? null;
    if (d == null) return { status: "ok", days: null };
    if (d > 45) return { status: "baja",     days: d };
    if (d > 30) return { status: "sinpagar", days: d - 30 };
    return { status: "ok", days: null };
  }
  const d    = c.daysSinceLastPack ?? null;
  const prod = c.lastPackProduct   ?? null;
  if (d != null && prod) {
    if (prod === "Pack Benvinguda") {
      if (d > 15) return { status: "caducado",  days: d - 15 };
      if (d > 12) return { status: "porvencer", days: 15 - d };
      return { status: "ok", days: null };
    }
    if (prod === "Pack 4 clases" || prod === "Pack 8 clases") {
      if (d > 105) return { status: "baja",      days: d - 90 };
      if (d > 90)  return { status: "caducado",  days: d - 90 };
      if (d > 76)  return { status: "porvencer", days: 90 - d };
    }
  }
  return { status: "ok", days: null };
}

export type PlanBadgeCfg = { label: string; cls: string };
export function planBadgeCfg(planType: "sub" | "pack" | "session", lastSubProduct?: string | null, lastPackProduct?: string | null): PlanBadgeCfg {
  if (planType === "sub") {
    if (lastSubProduct === "Bàsic") return { label: "Suscripción Bàsic", cls: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400" };
    if (lastSubProduct === "Plus")  return { label: "Suscripción Plus",  cls: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" };
    if (lastSubProduct === "Pro")   return { label: "Suscripción Pro",   cls: "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400" };
    return { label: "Suscripción",                                        cls: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400" };
  }
  if (planType === "pack") {
    if (lastPackProduct === "Pack 4 clases")   return { label: "Pack 4",       cls: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400" };
    if (lastPackProduct === "Pack 8 clases")   return { label: "Pack 8",       cls: "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300" };
    if (lastPackProduct === "Pack Benvinguda") return { label: "Pack Benvinguda", cls: "bg-pink-50 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400" };
    if (lastPackProduct === "Clase suelta")    return { label: "Clase suelta", cls: "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" };
    return { label: "Pack",                                                cls: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400" };
  }
  return { label: "Por sesión", cls: "bg-navy/[0.06] text-navy/55" };
}

/** Valor de filtro para clientes sin suscripción ni pack en curso (pagan por sesión suelta). */
export const SESSION_PLAN = "__session__";

/** Producto del plan vigente (la suscripción o pack más reciente): el mismo criterio que ya
 * usaba la búsqueda por texto, extraído para reutilizarlo en el filtro "Plan actual". */
export function currentPlanProduct(c: CustomerRow): string {
  const dSub  = c.daysSinceLastSub  ?? Infinity;
  const dPack = c.daysSinceLastPack ?? Infinity;
  const planType = dSub <= dPack && dSub < Infinity ? "sub" : dPack < Infinity ? "pack" : "session";
  if (planType === "sub")  return c.lastSubProduct  ?? SESSION_PLAN;
  if (planType === "pack") return c.lastPackProduct ?? SESSION_PLAN;
  return SESSION_PLAN;
}

export function initials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}
