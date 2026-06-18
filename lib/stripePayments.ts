import Stripe from "stripe";
import { unstable_cache } from "next/cache";
import { stripe } from "./stripe";

export type StripePayment = {
  id: string;
  amount: number;       // bruto — lo que paga el cliente, en euros
  fee: number;          // comisión Stripe, en euros
  net: number;          // neto — lo que llega al banco, en euros
  date: string;         // YYYY-MM-DD
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  description: string | null;
  method: string;       // "card" | "sepa_debit" | ...
  category: "Suscripción" | "Pago único";
  inferredProduct: string;  // nombre del producto inferido del importe
  inferredType: "subscription" | "pack" | "unknown";
};

// Mapa de importes → producto (precios Momence a jun 2026)
const PRODUCT_MAP: Array<{ amount: number; name: string; type: "subscription" | "pack" }> = [
  { amount: 75,  name: "Bàsic",           type: "subscription" },
  { amount: 140, name: "Plus",            type: "subscription" },
  { amount: 180, name: "Pro",             type: "subscription" },
  { amount: 90,  name: "Pack 4 clases",   type: "pack" },
  { amount: 170, name: "Pack 8 clases",   type: "pack" },
  { amount: 25,  name: "Pack Benvinguda", type: "pack" },
  { amount: 20,  name: "Clase suelta",    type: "pack" },
];

function inferProduct(amount: number): { name: string; type: "subscription" | "pack" | "unknown" } {
  const match = PRODUCT_MAP.find((p) => Math.abs(p.amount - amount) < 1);
  return match ? { name: match.name, type: match.type } : { name: "Otro", type: "unknown" };
}

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
    expand: ["data.balance_transaction"],
    ...(Object.keys(created).length > 0 ? { created } : {}),
  };

  const payments: StripePayment[] = [];

  for await (const charge of stripe.charges.list(params)) {
    if (charge.status !== "succeeded") continue;
    const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
    const fee = bt ? bt.fee / 100 : 0;
    const net = bt ? bt.net / 100 : toEuros(charge.amount, charge.currency);
    const amountEur = toEuros(charge.amount, charge.currency);
    const inferred  = inferProduct(amountEur);
    payments.push({
      id: charge.id,
      amount: amountEur,
      fee,
      net,
      date: toDate(charge.created),
      customerId: typeof charge.customer === "string" ? charge.customer : null,
      customerName: charge.billing_details?.name ?? null,
      customerEmail: charge.billing_details?.email ?? null,
      description: charge.description,
      method: charge.payment_method_details?.type ?? "card",
      category: deriveCategory(charge),
      inferredProduct: inferred.name,
      inferredType: inferred.type,
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

export type ProductRevenue = {
  product: string;
  type: "subscription" | "pack" | "unknown";
  revenue: number;
  count: number;
  uniqueCustomers: number;
};

export function stripeByProduct(payments: StripePayment[]): ProductRevenue[] {
  const map = new Map<string, { type: "subscription" | "pack" | "unknown"; revenue: number; count: number; emails: Set<string> }>();
  for (const p of payments) {
    const key = p.inferredProduct;
    const ex  = map.get(key) ?? { type: p.inferredType, revenue: 0, count: 0, emails: new Set() };
    ex.revenue += p.amount;
    ex.count   += 1;
    if (p.customerEmail) ex.emails.add(p.customerEmail.toLowerCase());
    map.set(key, ex);
  }
  return [...map.entries()]
    .map(([product, { type, revenue, count, emails }]) => ({
      product, type, revenue, count, uniqueCustomers: emails.size,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// Detect churned customers: paying monthly then silent for 45+ days
export type ChurnedCustomer = {
  email: string;
  name: string | null;
  lastPayment: string;
  lastProduct: string;
  daysSilent: number;
};

export function detectChurn(payments: StripePayment[], referenceDate?: string): ChurnedCustomer[] {
  const ref  = new Date(referenceDate ?? new Date().toISOString().split("T")[0]);
  const subs = payments.filter((p) => p.inferredType === "subscription");

  // Group by email, find last payment date
  const byEmail = new Map<string, { last: string; name: string | null; product: string }>();
  for (const p of subs) {
    if (!p.customerEmail) continue;
    const key = p.customerEmail.toLowerCase();
    const ex  = byEmail.get(key);
    if (!ex || p.date > ex.last) {
      byEmail.set(key, { last: p.date, name: p.customerName, product: p.inferredProduct });
    }
  }

  return [...byEmail.entries()]
    .map(([email, { last, name, product }]) => {
      const daysSilent = Math.floor((ref.getTime() - new Date(last).getTime()) / 86400000);
      return { email, name, lastPayment: last, lastProduct: product, daysSilent };
    })
    .filter((c) => c.daysSilent >= 45)
    .sort((a, b) => b.daysSilent - a.daysSilent);
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

export function totalFees(payments: StripePayment[]): number {
  return payments.reduce((s, p) => s + p.fee, 0);
}

export function feesForMonth(payments: StripePayment[], month: string): number {
  return payments
    .filter((p) => p.date.startsWith(month))
    .reduce((s, p) => s + p.fee, 0);
}

export function totalNet(payments: StripePayment[]): number {
  return payments.reduce((s, p) => s + p.net, 0);
}

// ── Cached loader (10 min, invalidable with revalidateTag('stripe')) ─────────────

export const loadStripePaymentsCached = unstable_cache(
  () => loadStripePayments(),
  ["stripe-payments"],
  { revalidate: 600, tags: ["stripe"] },
);

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
    email: p.customerEmail,
    name: p.customerName,
  }));
}
