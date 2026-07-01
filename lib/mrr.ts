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
// Deduplica por email: si la misma persona tiene dos cuentas de Momence o dos
// suscripciones solapadas, cuenta como una sola suscriptora por plan.
export function computeMrrByTier(customers: MomenceCustomer[], tiers: SubscriptionTier[]): TierMrr[] {
  const activeEmailsByTier = new Map<string, Set<string>>();

  for (const customer of customers) {
    const email = customer.email.toLowerCase().trim();
    const tiersThisCustomer = new Set<string>();
    for (const sub of customer.activeSubscriptions) {
      if (sub.type !== "subscription" || sub.isFreezed) continue;
      const tierName = sub.membership.name;
      // Una persona cuenta una sola vez por plan, aunque tenga varias subs solapadas
      if (!tiersThisCustomer.has(tierName)) {
        tiersThisCustomer.add(tierName);
        const emails = activeEmailsByTier.get(tierName) ?? new Set<string>();
        emails.add(email);
        activeEmailsByTier.set(tierName, emails);
      }
    }
  }

  return tiers.map((tier) => {
    const activeCount = (activeEmailsByTier.get(tier.name) ?? new Set()).size;
    const mrr = activeCount * tier.price;
    return { name: tier.name, price: tier.price, mrr, arr: mrr * 12, activeCount };
  });
}
