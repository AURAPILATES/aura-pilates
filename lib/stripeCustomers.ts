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
};

// ── Cached raw customer list from Stripe ──────────────────────────────────────

type RawCustomer = Pick<Stripe.Customer, "id" | "name" | "email" | "created" | "discount" | "delinquent">;

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
  };

  const stripeCustomers = await fetchStripeCustomerList();
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
    };
  }

  for (const group of byEmail.values()) customers.push(mergeGroup(group));
  for (const r of noEmail) customers.push(mergeGroup([r]));

  return customers.sort((a, b) => b.totalSpent - a.totalSpent);
}
