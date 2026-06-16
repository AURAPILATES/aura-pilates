import type { StripePayment } from "./stripePayments";
import type { MomenceMembership } from "./momence";

export type SubscriptionTier = {
  name: string;   // "Bàsic" | "Plus" | "Pro"
  price: number;  // precio mensual base, según el catálogo de Momence
};

export type TierMrr = {
  name: string;
  price: number;
  mrr: number;         // media de ingresos de los últimos 3 meses completos
  arr: number;          // mrr * 12
  activeCount: number;   // clientes que pagaron este tier el último mes completo
};

const PRICE_TOLERANCE = 2; // € — margen para no perder cargos con descuentos puntuales de céntimos

export function subscriptionTiersFromMemberships(memberships: MomenceMembership[]): SubscriptionTier[] {
  return memberships
    .filter((m) => m.type === "subscription" && !m.isDeleted)
    .map((m) => ({ name: m.name, price: m.price }));
}

function matchTier(amount: number, tiers: SubscriptionTier[]): SubscriptionTier | null {
  return tiers.find((t) => Math.abs(amount - t.price) <= PRICE_TOLERANCE) ?? null;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function monthOffset(base: Date, n: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

// MRR/ARR por suscripción, identificando el tier de cada cobro de Stripe por su importe
// (no necesitamos CSV: el precio que paga el cliente ya nos dice qué producto compró).
export function computeMrrByTier(
  payments: StripePayment[],
  tiers: SubscriptionTier[],
  curMonth: string, // "YYYY-MM"
): TierMrr[] {
  const now = new Date(curMonth + "-01");
  const lastCompleteMonth = monthOffset(now, -1);
  const last3Months = [monthOffset(now, -1), monthOffset(now, -2), monthOffset(now, -3)];

  return tiers.map((tier) => {
    const tierPayments = payments.filter((p) => matchTier(p.amount, tiers)?.name === tier.name);

    const totals = last3Months.map((m) =>
      tierPayments.filter((p) => p.date.startsWith(m)).reduce((s, p) => s + p.amount, 0),
    );
    const filled = totals.filter((t) => t > 0);
    const mrr = filled.length > 0 ? filled.reduce((a, b) => a + b, 0) / filled.length : 0;

    const activeCount = new Set(
      tierPayments.filter((p) => p.date.startsWith(lastCompleteMonth) && p.customerId).map((p) => p.customerId!),
    ).size;

    return { name: tier.name, price: tier.price, mrr, arr: mrr * 12, activeCount };
  });
}
