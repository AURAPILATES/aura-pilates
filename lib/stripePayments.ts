import Stripe from "stripe";
import { stripe } from "./stripe";

export type StripePayment = {
  id: string;
  amount: number;       // euros
  date: string;         // YYYY-MM-DD
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  description: string | null;
  method: string;       // "card" | "sepa_debit" | ...
  category: "Suscripción" | "Pago único";
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toEuros(amount: number, currency: string): number {
  // Stripe stores amounts in smallest currency unit (cents for EUR)
  const zeroDecimal = ["jpy", "krw", "vnd"];
  return zeroDecimal.includes(currency) ? amount : amount / 100;
}

function toDate(ts: number): string {
  return new Date(ts * 1000).toISOString().split("T")[0];
}

function deriveCategory(charge: Stripe.Charge): "Suscripción" | "Pago único" {
  // charge.invoice is a string ID when present (not expanded)
  if ((charge as unknown as Record<string, unknown>).invoice) return "Suscripción";
  const desc = (charge.description ?? "").toLowerCase();
  if (desc.includes("sub") || desc.includes("suscri") || desc.includes("mensual")) return "Suscripción";
  return "Pago único";
}

// ── Load all succeeded charges with auto-pagination ───────────────────────────

export async function loadStripePayments(
  from?: string | null,
  to?: string | null,
): Promise<StripePayment[]> {
  const created: Stripe.RangeQueryParam = {};
  if (from) created.gte = Math.floor(new Date(from).getTime() / 1000);
  if (to) {
    const d = new Date(to);
    d.setDate(d.getDate() + 1);
    created.lt = Math.floor(d.getTime() / 1000);
  }

  const params: Stripe.ChargeListParams = {
    limit: 100,
    ...(Object.keys(created).length > 0 ? { created } : {}),
  };

  const payments: StripePayment[] = [];

  for await (const charge of stripe.charges.list(params)) {
    if (charge.status !== "succeeded") continue;
    payments.push({
      id: charge.id,
      amount: toEuros(charge.amount, charge.currency),
      date: toDate(charge.created),
      customerId: typeof charge.customer === "string" ? charge.customer : null,
      customerName: charge.billing_details?.name ?? null,
      customerEmail: charge.billing_details?.email ?? null,
      description: charge.description,
      method: charge.payment_method_details?.type ?? "card",
      category: deriveCategory(charge),
    });
  }

  return payments;
}

// ── Analytics (equivalentes a los de sales.ts) ────────────────────────────────

const MONTH_LABELS: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

export type MonthlyRevenue = { month: string; label: string; revenue: number; count: number };

export function stripeByMonth(payments: StripePayment[]): MonthlyRevenue[] {
  const map = new Map<string, { revenue: number; count: number }>();
  for (const p of payments) {
    const m = p.date.slice(0, 7);
    const prev = map.get(m) ?? { revenue: 0, count: 0 };
    map.set(m, { revenue: prev.revenue + p.amount, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { revenue, count }]) => {
      const [year, mm] = month.split("-");
      return { month, label: `${MONTH_LABELS[mm] ?? mm} ${year}`, revenue, count };
    });
}

export type MethodRevenue = { method: string; label: string; revenue: number; count: number };

const METHOD_LABELS: Record<string, string> = {
  card: "Tarjeta",
  sepa_debit: "SEPA",
  paypal: "PayPal",
  link: "Link",
};

export function stripeByMethod(payments: StripePayment[]): MethodRevenue[] {
  const map = new Map<string, { revenue: number; count: number }>();
  for (const p of payments) {
    const prev = map.get(p.method) ?? { revenue: 0, count: 0 };
    map.set(p.method, { revenue: prev.revenue + p.amount, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .map(([method, { revenue, count }]) => ({
      method,
      label: METHOD_LABELS[method] ?? method,
      revenue,
      count,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function totalRevenue(payments: StripePayment[]): number {
  return payments.reduce((s, p) => s + p.amount, 0);
}

export function revenueForMonth(payments: StripePayment[], month: string): number {
  return payments
    .filter((p) => p.date.startsWith(month))
    .reduce((s, p) => s + p.amount, 0);
}

export function subscriptionRevenue(payments: StripePayment[]): number {
  return payments.filter((p) => p.category === "Suscripción").reduce((s, p) => s + p.amount, 0);
}

// ── Compatibility shim: convert to Sale shape for existing charts ──────────────

import type { Sale } from "./sales";

const STRIPE_METHOD_LABEL: Record<string, string> = {
  card: "Tarjeta",
  sepa_debit: "SEPA",
  paypal: "PayPal",
  link: "Link",
};

export function toSales(payments: StripePayment[]): Sale[] {
  return payments.map((p) => ({
    category: p.category,
    item: p.description ?? p.category,
    paymentDate: p.date,
    serviceDate: p.date,
    method: STRIPE_METHOD_LABEL[p.method] ?? p.method,
    amount: p.amount,
    tax: 0,
  }));
}
