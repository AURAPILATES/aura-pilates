import type { StripePayment, ProductPriceCandidate } from "./stripePayments";
import type { MomenceV2MembershipCatalog } from "./momenceV2";

const MONTH_LABELS: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

export type CatalogItem = { name: string; price: number; type: string };

const PRICE_TOLERANCE = 2; // € - margen para no perder cargos con descuentos puntuales de céntimos

// Catálogo (suscripciones + packs) desde la API pública v2 (OAuth2): /host/memberships
// devuelve en un único listado ambos tipos, con precio real - no hace falta combinar
// membresías y "productos" de dos endpoints v1 distintos como antes (v1 tenía además un
// token de sesión frágil, ver [[project-momence-v2]]).
export function catalogFromMomenceV2(items: MomenceV2MembershipCatalog[]): CatalogItem[] {
  return items
    .filter((m) => !m.disabled)
    .map((m) => ({ name: m.name, price: m.price, type: m.type }));
}

// Catálogo para identificar cobros de Stripe por importe (Ventas por Producto, Retención por
// cohorte): a diferencia de catalogFromMomenceV2, incluye el precio de RESPALDO además del
// vigente (ver resolveProductMap en stripePayments.ts) y nombres canónicos en español - así un
// cambio de precio histórico no deja cobros antiguos sin identificar, y las claves coinciden con
// StripePayment.inferredProduct (mismo origen), que es justo lo que usan los drawers para filtrar.
export function catalogFromStripeProductMap(candidates: ProductPriceCandidate[]): CatalogItem[] {
  return candidates.map((c) => ({ name: c.name, price: c.amount, type: c.type }));
}

export type ProductRevenueRow = {
  item: string;
  category: string; // "Suscripción" | "Paquete" | "Otros"
  revenue: number;
  count: number;
};

// Desglose de ingresos por producto identificando el producto por el importe del
// cobro en Stripe contra el catálogo en vivo de Momence (sin CSV).
export function revenueByProductFromStripe(payments: StripePayment[], catalog: CatalogItem[]): ProductRevenueRow[] {
  const map = new Map<string, ProductRevenueRow>();
  for (const p of payments) {
    const match = catalog.find((c) => Math.abs(p.amount - c.price) <= PRICE_TOLERANCE);
    const item = match ? match.name : "Otros";
    const category = match ? (match.type === "subscription" ? "Suscripción" : "Paquete") : "Otros";
    const prev = map.get(item) ?? { item, category, revenue: 0, count: 0 };
    prev.revenue += p.amount;
    prev.count += 1;
    map.set(item, prev);
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export type MonthlyProductRevenue = {
  month: string;   // "YYYY-MM"
  label: string;   // "Feb 2026"
  items: { name: string; revenue: number }[];
  total: number;
};

// Igual que revenueByProductFromStripe pero mes a mes, para un gráfico de evolución.
export function revenueByProductByMonth(payments: StripePayment[], catalog: CatalogItem[]): MonthlyProductRevenue[] {
  const byMonth = new Map<string, Map<string, number>>();
  for (const p of payments) {
    const month = p.date.slice(0, 7);
    const match = catalog.find((c) => Math.abs(p.amount - c.price) <= PRICE_TOLERANCE);
    const item = match ? match.name : "Otros";
    const monthMap = byMonth.get(month) ?? new Map<string, number>();
    monthMap.set(item, (monthMap.get(item) ?? 0) + p.amount);
    byMonth.set(month, monthMap);
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, byItem]) => {
      const [y, mm] = month.split("-");
      const items = Array.from(byItem.entries()).map(([name, revenue]) => ({ name, revenue }));
      return {
        month,
        label: `${MONTH_LABELS[mm] ?? mm} ${y}`,
        items: items.sort((a, b) => b.revenue - a.revenue),
        total: items.reduce((s, i) => s + i.revenue, 0),
      };
    });
}

// Añade los ingresos de Urban Sports Club (CSV) como un item más a la evolución mensual.
export function addUscToMonthlyRevenue(
  monthly: MonthlyProductRevenue[],
  uscByMonth: Map<string, number>,
): MonthlyProductRevenue[] {
  const months = new Set([...monthly.map((m) => m.month), ...uscByMonth.keys()]);
  return Array.from(months)
    .sort()
    .map((month) => {
      const existing = monthly.find((m) => m.month === month);
      const [y, mm] = month.split("-");
      const items = [...(existing?.items ?? [])];
      const uscRevenue = uscByMonth.get(month);
      if (uscRevenue) items.push({ name: "Urban", revenue: uscRevenue });
      return {
        month,
        label: existing?.label ?? `${MONTH_LABELS[mm] ?? mm} ${y}`,
        items: items.sort((a, b) => b.revenue - a.revenue),
        total: items.reduce((s, i) => s + i.revenue, 0),
      };
    });
}
