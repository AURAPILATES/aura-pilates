import Stripe from "stripe";
import { stripe } from "./stripe";

export type StripeSubscription = {
  id: string;
  customerId: string;
  customerEmail: string | null;
  customerName: string | null;
  status: string;
  plan: string;
  amount: number;            // euros/mes
  currentPeriodEnd: string;  // YYYY-MM-DD
  canceledAt: string | null;
  createdAt: string;
};

function ts(unix: number): string {
  return new Date(unix * 1000).toISOString().split("T")[0];
}

export async function loadStripeSubscriptions(): Promise<StripeSubscription[]> {
  const subs: StripeSubscription[] = [];

  for await (const sub of stripe.subscriptions.list({
    limit: 100,
    status: "all",
    expand: ["data.customer", "data.items.data.price"],
  })) {
    const cust = sub.customer;
    const customer = typeof cust === "object" && cust !== null && !("deleted" in cust)
      ? (cust as Stripe.Customer) : null;

    const item  = sub.items.data[0];
    const price = item?.price;
    const productName = price?.nickname ?? price?.id ?? "Plan";

    subs.push({
      id: sub.id,
      customerId: typeof sub.customer === "string"
        ? sub.customer
        : (sub.customer as Stripe.Customer)?.id ?? "",
      customerEmail: customer?.email ?? null,
      customerName:  customer?.name  ?? null,
      status:  sub.status,
      plan:    productName,
      amount:  (price?.unit_amount ?? 0) / 100,
      currentPeriodEnd: ts((sub as unknown as { current_period_end: number }).current_period_end),
      canceledAt: sub.canceled_at ? ts(sub.canceled_at) : null,
      createdAt:  ts(sub.created),
    });
  }

  return subs;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export function activeSubs(subs: StripeSubscription[]): StripeSubscription[] {
  return subs.filter((s) => s.status === "active" || s.status === "trialing");
}

export function mrrFromSubs(subs: StripeSubscription[]): number {
  return activeSubs(subs).reduce((sum, s) => sum + s.amount, 0);
}

export function churnedThisMonth(subs: StripeSubscription[], month: string): StripeSubscription[] {
  return subs.filter((s) => s.canceledAt?.startsWith(month) ?? false);
}

export function renewingInDays(subs: StripeSubscription[], days: number): StripeSubscription[] {
  const today  = new Date().toISOString().split("T")[0];
  const future = new Date();
  future.setDate(future.getDate() + days);
  const futureStr = future.toISOString().split("T")[0];
  return activeSubs(subs).filter(
    (s) => s.currentPeriodEnd >= today && s.currentPeriodEnd <= futureStr,
  );
}
