import Stripe from "stripe";
import { stripe } from "./stripe";
import type { StripeSubscription } from "./stripeSubscriptions";
import type { StripePayment } from "./stripePayments";

export type StripeDiscount = {
  name: string;
  percentOff: number | null;
  amountOff: number | null;
};

export type StripeCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  totalSpent: number;
  paymentCount: number;
  lastPaymentDate: string | null;
  subscription: StripeSubscription | null;
  discount: StripeDiscount | null;
};

export async function loadStripeCustomers(
  payments: StripePayment[],
  subscriptions: StripeSubscription[],
): Promise<StripeCustomer[]> {
  // Payment stats by customer
  const byCustomer = new Map<string, { total: number; count: number; last: string }>();
  for (const p of payments) {
    if (!p.customerId) continue;
    const prev = byCustomer.get(p.customerId) ?? { total: 0, count: 0, last: "" };
    byCustomer.set(p.customerId, {
      total: prev.total + p.amount,
      count: prev.count + 1,
      last:  p.date > prev.last ? p.date : prev.last,
    });
  }

  // Active subscription by customer
  const activeSub = new Map<string, StripeSubscription>();
  for (const sub of subscriptions) {
    if (sub.status === "active" || sub.status === "trialing") {
      activeSub.set(sub.customerId, sub);
    }
  }

  const customers: StripeCustomer[] = [];

  for await (const raw of stripe.customers.list({ limit: 100, expand: ["data.discount.coupon"] })) {
    if ((raw as unknown as { deleted?: boolean }).deleted) continue;
    const c = raw as Stripe.Customer;
    const stats = byCustomer.get(c.id);
    if (!stats) continue;

    const rawDiscount = c.discount as unknown as { coupon?: { id: string; name?: string | null; percent_off?: number | null; amount_off?: number | null } } | null;
    const disc = rawDiscount?.coupon ?? null;
    const discount: StripeDiscount | null = disc
      ? {
          name:       disc.name ?? disc.id ?? "Descuento",
          percentOff: disc.percent_off ?? null,
          amountOff:  disc.amount_off ? disc.amount_off / 100 : null,
        }
      : null;

    customers.push({
      id:    c.id,
      name:  c.name  ?? null,
      email: c.email ?? null,
      createdAt:       new Date(c.created * 1000).toISOString().split("T")[0],
      totalSpent:      stats.total,
      paymentCount:    stats.count,
      lastPaymentDate: stats.last || null,
      subscription:    activeSub.get(c.id) ?? null,
      discount,
    });
  }

  return customers.sort((a, b) => b.totalSpent - a.totalSpent);
}
