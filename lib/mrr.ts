import type { ProductPriceCandidate } from "./stripePayments";

export type SubscriptionTier = {
  name: string;   // "Bàsic" | "Plus" | "Pro"
  price: number;  // precio mensual, según el catálogo de Momence
};

// El MRR/ARR real por suscripción ya no se calcula aquí: sale de subscriber_snapshots_v2
// (ver getMrrHistoryV2/getSubscriptionsBaseV2 en lib/subscriptionsV2.ts), que cuenta
// suscriptoras activas reales en vez de adivinar por email desde la API interna. Esta
// función solo da la lista de referencia {name, price} contra la que esas consultas
// hacen join por nombre de plan.
//
// Se construye a partir de resolveProductMap() (stripePayments.ts) en vez de pedir el
// catálogo de Momence otra vez por separado - evita una tercera llamada redundante a
// /host/memberships en la misma carga de página. El primer candidato de cada nombre es
// siempre el precio resuelto (vigente, o de respaldo si Momence no respondió) - ver el
// orden de push en resolveProductMap -, así que quedarse con el primero basta para tener
// un único precio "vigente" por plan, igual que antes.
export function subscriptionTiersFromPriceCandidates(candidates: ProductPriceCandidate[]): SubscriptionTier[] {
  const priceByName = new Map<string, number>();
  for (const c of candidates) {
    if (c.type !== "subscription") continue;
    if (!priceByName.has(c.name)) priceByName.set(c.name, c.amount);
  }
  return [...priceByName.entries()].map(([name, price]) => ({ name, price }));
}
