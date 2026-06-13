import Stripe from "stripe";
import { stripe } from "./stripe";
import type { StripePayment } from "./stripePayments";
import { recurringCustomerIds } from "./stripeRecurrence";

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
  firstPaymentDate: string | null;
  isRecurring: boolean;
  discount: StripeDiscount | null;
};

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
      id:               c.id,
      name:             c.name  ?? null,
      email:            c.email ?? null,
      createdAt:        new Date(c.created * 1000).toISOString().split("T")[0],
      totalSpent:       stats.total,
      paymentCount:     stats.count,
      lastPaymentDate:  stats.last  || null,
      firstPaymentDate: stats.first !== "9999-99-99" ? stats.first : null,
      isRecurring:      recurring.has(c.id),
      discount,
    });
  }

  return customers.sort((a, b) => b.totalSpent - a.totalSpent);
}
