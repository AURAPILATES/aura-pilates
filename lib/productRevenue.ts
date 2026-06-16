import type { StripePayment } from "./stripePayments";
import type { MomenceMembership, MomenceProduct } from "./momence";

export type CatalogItem = { name: string; price: number; type: string };

const PRICE_TOLERANCE = 2; // € — margen para no perder cargos con descuentos puntuales de céntimos

export function catalogFromMomence(memberships: MomenceMembership[], products: MomenceProduct[]): CatalogItem[] {
  return [
    ...memberships.filter((m) => !m.isDeleted).map((m) => ({ name: m.name, price: m.price, type: m.type })),
    ...products.filter((p) => !p.isDeleted).map((p) => ({ name: p.name, price: p.price, type: "product" })),
  ];
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
