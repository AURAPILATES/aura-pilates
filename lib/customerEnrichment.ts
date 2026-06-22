import type { StripeCustomer } from "./stripeCustomers";
import type { StripePayment } from "./stripePayments";

export type ChurnFields = {
  daysSinceLastSub?: number | null;
  daysSinceLastPack?: number | null;
  lastPackProduct?: string | null;
  lastSubProduct?: string | null;
  isActive?: boolean;
  isNew?: boolean;
};

export type EnrichedCustomer = StripeCustomer & ChurnFields;

/** Añade a cada cliente fusionado (por email) sus últimas fechas de suscripción/pack, vistas a través de todos sus stripeIds. */
export function enrichCustomers(
  customers: StripeCustomer[],
  payments: StripePayment[],
  opts?: { activeIds?: Set<string>; newIds?: Set<string> },
): EnrichedCustomer[] {
  const lastSubById  = new Map<string, { date: string; product: string }>();
  const lastPackById = new Map<string, { date: string; product: string }>();

  for (const p of payments) {
    if (!p.customerId) continue;
    if (p.inferredType === "subscription") {
      const ex = lastSubById.get(p.customerId);
      if (!ex || p.date > ex.date) lastSubById.set(p.customerId, { date: p.date, product: p.inferredProduct });
    } else if (p.inferredType === "pack") {
      const ex = lastPackById.get(p.customerId);
      if (!ex || p.date > ex.date) lastPackById.set(p.customerId, { date: p.date, product: p.inferredProduct });
    }
  }

  const today = new Date();
  function daysSince(dateStr: string): number {
    return Math.floor((today.getTime() - new Date(dateStr + "T12:00:00").getTime()) / 86_400_000);
  }

  return customers.map((c) => {
    let lastSub:  { date: string; product: string } | null = null;
    let lastPack: { date: string; product: string } | null = null;
    for (const sid of c.stripeIds) {
      const sub  = lastSubById.get(sid);
      if (sub  && (!lastSub  || sub.date  > lastSub.date))  lastSub  = sub;
      const pack = lastPackById.get(sid);
      if (pack && (!lastPack || pack.date > lastPack.date)) lastPack = pack;
    }
    return {
      ...c,
      daysSinceLastSub:  lastSub  ? daysSince(lastSub.date)  : null,
      daysSinceLastPack: lastPack ? daysSince(lastPack.date) : null,
      lastPackProduct:   lastPack?.product ?? null,
      lastSubProduct:    lastSub?.product  ?? null,
      isActive: opts?.activeIds ? c.stripeIds.some((sid) => opts.activeIds!.has(sid)) : undefined,
      isNew:    opts?.newIds    ? c.stripeIds.some((sid) => opts.newIds!.has(sid))    : undefined,
    };
  });
}

/** Suscripción vigente: cliente recurrente que renovó hace ≤30 días. */
export function hasActiveSub(c: ChurnFields & { isRecurring?: boolean }): boolean {
  return !!c.isRecurring && c.daysSinceLastSub != null && c.daysSinceLastSub <= 30;
}

/** Pack dentro de plazo (Benvinguda: 15d · Pack 4/8 clases: 90d). */
export function hasActivePack(c: ChurnFields): boolean {
  const d = c.daysSinceLastPack;
  if (d == null) return false;
  const prod = c.lastPackProduct;
  if (prod === "Pack Benvinguda") return d <= 15;
  if (prod === "Pack 4 clases" || prod === "Pack 8 clases") return d <= 90;
  return false;
}

/** Bajas de suscripción: 46-76 días sin pagar (31 días de gracia + 15 de confirmación). Tope 76d para no recoger meses anteriores. */
export function isChurned(c: ChurnFields): boolean {
  const d = c.daysSinceLastSub;
  return d != null && d >= 46 && d <= 76;
}
