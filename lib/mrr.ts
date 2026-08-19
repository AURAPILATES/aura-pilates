import type { MomenceV2MembershipCatalog } from "./momenceV2";

export type SubscriptionTier = {
  name: string;   // "Bàsic" | "Plus" | "Pro"
  price: number;  // precio mensual, según el catálogo de Momence
};

// El MRR/ARR real por suscripción ya no se calcula aquí: sale de subscriber_snapshots_v2
// (ver getMrrHistoryV2/getSubscriptionsBaseV2 en lib/subscriptionsV2.ts), que cuenta
// suscriptoras activas reales en vez de adivinar por email desde la API interna. Esta
// función solo da la lista de referencia {name, price} contra la que esas consultas
// hacen join por nombre de plan.
export function subscriptionTiersFromMembershipsV2(catalog: MomenceV2MembershipCatalog[]): SubscriptionTier[] {
  return catalog
    .filter((m) => m.type === "subscription" && !m.disabled)
    .map((m) => ({ name: m.name, price: m.price }));
}
