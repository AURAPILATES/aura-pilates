import type { MomenceMembership, MomenceCustomer } from "./momence";

export type SubscriptionTier = {
  name: string;   // "Bàsic" | "Plus" | "Pro"
  price: number;  // precio mensual, según el catálogo de Momence
};

export type TierMrr = {
  name: string;
  price: number;
  mrr: number;          // activeCount * price
  arr: number;           // mrr * 12
  activeCount: number;
};

export function subscriptionTiersFromMemberships(memberships: MomenceMembership[]): SubscriptionTier[] {
  return memberships
    .filter((m) => m.type === "subscription" && !m.isDeleted)
    .map((m) => ({ name: m.name, price: m.price }));
}

// MRR/ARR por suscripción contando suscriptores activos reales en Momence
// (no congelados), en vez de adivinar por el importe del cobro en Stripe.
export function computeMrrByTier(customers: MomenceCustomer[], tiers: SubscriptionTier[]): TierMrr[] {
  const activeCountByTier = new Map<string, number>();

  for (const customer of customers) {
    for (const sub of customer.activeSubscriptions) {
      if (sub.type !== "subscription" || sub.isFreezed) continue;
      activeCountByTier.set(sub.membership.name, (activeCountByTier.get(sub.membership.name) ?? 0) + 1);
    }
  }

  return tiers.map((tier) => {
    const activeCount = activeCountByTier.get(tier.name) ?? 0;
    const mrr = activeCount * tier.price;
    return { name: tier.name, price: tier.price, mrr, arr: mrr * 12, activeCount };
  });
}
