import Stripe from "stripe";
import { unstable_cache } from "next/cache";
import { stripe } from "./stripe";
import type { StripePayment } from "./stripePayments";
import { recurringCustomerIds } from "./stripeRecurrence";

export type StripeDiscount = {
  name: string;
  percentOff: number | null;
  amountOff: number | null;
};

export type StripeCustomer = {
  id: string;           // ID primario (el más antiguo)
  stripeIds: string[];  // todos los IDs fusionados
  name: string | null;
  email: string | null;
  createdAt: string;
  totalSpent: number;
  paymentCount: number;
  lastPaymentDate: string | null;
  firstPaymentDate: string | null;
  isRecurring: boolean;
  discount: StripeDiscount | null;
  delinquent: boolean;
  hasPaymentError: boolean; // delinquent OR invoice intentada y no cobrada
};

// ── Cached raw customer list from Stripe ──────────────────────────────────────

type RawCustomer = Pick<Stripe.Customer, "id" | "name" | "email" | "created" | "discount" | "delinquent">;

// IDs de clientes con pagos fallidos en los últimos 90 días
// Cubre: (1) facturas de suscripción intentadas y no cobradas, (2) PaymentIntents fallidos directos
const fetchFailedPaymentCustomerIds = unstable_cache(
  async (): Promise<string[]> => {
    const cutoff = Math.floor(Date.now() / 1000) - 90 * 86400;
    const ids = new Set<string>();

    // Facturas abiertas que Stripe ya intentó cobrar
    for await (const inv of stripe.invoices.list({ status: "open", limit: 100, created: { gte: cutoff } })) {
      if (!inv.attempted) continue;
      const cid = typeof inv.customer === "string" ? inv.customer : (inv.customer as Stripe.Customer | null)?.id ?? null;
      if (cid) ids.add(cid);
    }

    // PaymentIntents fallidos (requires_payment_method + last_payment_error)
    for await (const pi of stripe.paymentIntents.list({ limit: 100, created: { gte: cutoff } })) {
      if (pi.status !== "requires_payment_method" || !pi.last_payment_error) continue;
      const cid = typeof pi.customer === "string" ? pi.customer : (pi.customer as Stripe.Customer | null)?.id ?? null;
      if (cid) ids.add(cid);
    }

    return [...ids];
  },
  ["stripe-failed-payments"],
  { revalidate: 600, tags: ["stripe"] },
);

const fetchStripeCustomerList = unstable_cache(
  async (): Promise<RawCustomer[]> => {
    const result: RawCustomer[] = [];
    for await (const raw of stripe.customers.list({ limit: 100, expand: ["data.discount.coupon"] })) {
      if ((raw as unknown as { deleted?: boolean }).deleted) continue;
      result.push(raw as Stripe.Customer);
    }
    return result;
  },
  ["stripe-customer-list"],
  { revalidate: 600, tags: ["stripe"] },
);

// ─────────────────────────────────────────────────────────────────────────────

export async function loadStripeCustomers(
  payments: StripePayment[],
  curMonth: string,
): Promise<StripeCustomer[]> {
  // Payment stats by customer
  const byCustomer = new Map<string, { total: number; count: number; last: string; first: string }>();
  for (const p of payments) {
    if (!p.customerId) continue;
    const prev = byCustomer.get(p.customerId) ?? { total: 0, count: 0, last: "", first: "9999-99-99" };
    byCustomer.set(p.customerId, {
      total: prev.total + p.amount,
      count: prev.count + 1,
      last:  p.date > prev.last  ? p.date : prev.last,
      first: p.date < prev.first ? p.date : prev.first,
    });
  }

  const recurring = recurringCustomerIds(payments, curMonth);

  type RawEntry = {
    id: string; name: string | null; email: string | null;
    createdAt: string; discount: StripeDiscount | null;
    stats: { total: number; count: number; last: string; first: string };
    isRecurring: boolean;
    delinquent: boolean;
    hasPaymentError: boolean;
  };

  const [stripeCustomers, failedInvoiceIds] = await Promise.all([
    fetchStripeCustomerList(),
    fetchFailedPaymentCustomerIds().then((ids) => new Set(ids)),
  ]);
  const raw_customers: RawEntry[] = [];

  for (const c of stripeCustomers) {
    const stats = byCustomer.get(c.id);
    if (!stats) continue;

    const rawDiscount = c.discount as unknown as { coupon?: { id: string; name?: string | null; percent_off?: number | null; amount_off?: number | null } } | null;
    const disc = rawDiscount?.coupon ?? null;
    const discount: StripeDiscount | null = disc
      ? { name: disc.name ?? disc.id ?? "Descuento", percentOff: disc.percent_off ?? null, amountOff: disc.amount_off ? disc.amount_off / 100 : null }
      : null;

    raw_customers.push({
      id: c.id,
      name: c.name ?? null,
      email: c.email ?? null,
      createdAt: new Date(c.created * 1000).toISOString().split("T")[0],
      discount,
      stats,
      isRecurring: recurring.has(c.id),
      delinquent: c.delinquent ?? false,
      hasPaymentError: (c.delinquent ?? false) || failedInvoiceIds.has(c.id),
    });
  }

  // Merge duplicate emails — keep oldest createdAt as primary id
  const byEmail = new Map<string, RawEntry[]>();
  const noEmail: RawEntry[] = [];
  for (const r of raw_customers) {
    const key = r.email?.toLowerCase().trim();
    if (!key) { noEmail.push(r); continue; }
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key)!.push(r);
  }

  const customers: StripeCustomer[] = [];

  function mergeGroup(group: RawEntry[]): StripeCustomer {
    // Sort by createdAt ascending so the oldest is primary
    group.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const primary = group[0];
    const merged = group.reduce(
      (acc, r) => ({
        total: acc.total + r.stats.total,
        count: acc.count + r.stats.count,
        last:  r.stats.last  > acc.last  ? r.stats.last  : acc.last,
        first: r.stats.first < acc.first ? r.stats.first : acc.first,
      }),
      { total: 0, count: 0, last: "", first: "9999-99-99" },
    );
    return {
      id:              primary.id,
      stripeIds:       group.map((r) => r.id),
      name:            primary.name,
      email:           primary.email,
      createdAt:       primary.createdAt,
      totalSpent:      merged.total,
      paymentCount:    merged.count,
      lastPaymentDate: merged.last  || null,
      firstPaymentDate: merged.first !== "9999-99-99" ? merged.first : null,
      isRecurring:     group.some((r) => r.isRecurring || recurring.has(r.id)),
      discount:        primary.discount,
      delinquent:      group.some((r) => r.delinquent),
      hasPaymentError: group.some((r) => r.hasPaymentError),
    };
  }

  for (const group of byEmail.values()) customers.push(mergeGroup(group));
  for (const r of noEmail) customers.push(mergeGroup([r]));

  return customers.sort((a, b) => b.totalSpent - a.totalSpent);
}

export async function loadDelinquentCustomers(): Promise<{ name: string | null; email: string | null }[]> {
  const list = await fetchStripeCustomerList();
  return list
    .filter((c) => c.delinquent)
    .map((c) => ({ name: (c as Stripe.Customer).name ?? null, email: (c as Stripe.Customer).email ?? null }));
}
