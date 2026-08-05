import Stripe from "stripe";
import { unstable_cache } from "next/cache";
import { stripe } from "./stripe";
import { getMembershipsV2 } from "./momenceV2";
import { catalogFromMomenceV2 } from "./productRevenue";

export type StripePayment = {
  id: string;
  amount: number;       // bruto - lo que paga el cliente, en euros
  fee: number;          // comisión Stripe, en euros
  net: number;          // neto - lo que llega al banco, en euros
  date: string;         // YYYY-MM-DD
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  description: string | null;
  method: string;       // "card" | "sepa_debit" | ...
  category: "Suscripción" | "Pago único";
  inferredProduct: string;  // nombre del producto inferido del importe
  inferredType: "subscription" | "pack" | "coupon" | "unknown";
};

// Nombres/tipos de producto de referencia - estables, no cambian cuando sube un precio.
// `name` es el identificador CANÓNICO interno de la app (se usa como clave en muchos sitios:
// ventana de vigencia, etiquetas de cliente, etc.), no tocar. El IMPORTE de cada uno se
// resuelve en vivo contra el catálogo de Momence (ver getPricingReport más abajo); el valor
// de aquí solo se usa como respaldo si Momence no responde o si ese nombre ya no existe en su
// catálogo. `momenceName` es el nombre EXACTO tal como aparece en Momence cuando difiere del
// canónico (p.ej. Momence llama a los packs "…classes" y aquí el canónico es "…clases");
// se usa solo para el cruce con su catálogo. Última revisión manual: jul 2026.
const PRODUCT_MAP: Array<{ amount: number; name: string; type: "subscription" | "pack"; momenceName?: string }> = [
  { amount: 75,  name: "Bàsic",           type: "subscription" },
  { amount: 140, name: "Plus",            type: "subscription" },
  { amount: 180, name: "Pro",             type: "subscription" },
  { amount: 90,  name: "Pack 4 clases",   type: "pack", momenceName: "Pack 4 classes" },
  { amount: 170, name: "Pack 8 clases",   type: "pack", momenceName: "Pack 8 classes" },
  { amount: 25,  name: "Pack Benvinguda", type: "pack" },
  { amount: 20,  name: "Clase suelta",    type: "pack" },
];

export type PricingRow = {
  name: string;
  type: "subscription" | "pack";
  fallbackPrice: number;
  livePrice: number | null;
  /** El precio realmente usado para identificar cobros de Stripe ahora mismo: el de Momence
   * si se ha encontrado ese nombre en su catálogo, si no el de respaldo del código. */
  price: number;
};

/** Compara los precios de referencia del código con el catálogo en vivo de Momence
 * (membresías + productos), por nombre exacto. Vista de solo lectura en Configuración →
 * Precios y también la fuente que usa loadStripePayments para identificar cada cobro. */
export const getPricingReport = unstable_cache(
  async (): Promise<PricingRow[]> => {
    let catalog: { name: string; price: number }[] = [];
    try {
      catalog = catalogFromMomenceV2(await getMembershipsV2());
    } catch {
      // Momence caído o sin credenciales: seguimos con los precios de respaldo del código.
    }
    return PRODUCT_MAP.map((entry) => {
      const live = catalog.find((c) => c.name === (entry.momenceName ?? entry.name));
      return {
        name: entry.name,
        type: entry.type,
        fallbackPrice: entry.amount,
        livePrice: live ? live.price : null,
        price: live ? live.price : entry.amount,
      };
    });
  },
  ["stripe-pricing-report"],
  { revalidate: 1800, tags: ["momence"] },
);

// Cada producto puede tener DOS precios candidatos válidos: el vigente hoy en Momence y el de
// respaldo del código (última revisión manual). Antes solo se aceptaba el vigente, así que un
// cambio de precio de un día para otro reclasificaba mal (o mandaba a "Con cupón") todos los
// cobros históricos hechos al precio anterior. Aceptar ambos evita esa corrupción retroactiva;
// no soluciona el caso de un descuento puntual que coincida con el precio de otro producto, eso
// solo lo resuelve /host/sales de Momence (ver docs/fuentes-de-datos.md).
async function resolveProductMap(): Promise<typeof PRODUCT_MAP> {
  const report = await getPricingReport();
  const map: typeof PRODUCT_MAP = [];
  for (const r of report) {
    map.push({ amount: r.price, name: r.name, type: r.type });
    if (r.livePrice !== null && Math.abs(r.livePrice - r.fallbackPrice) >= 1) {
      map.push({ amount: r.fallbackPrice, name: r.name, type: r.type });
    }
  }
  return map;
}

function inferProduct(
  amount: number,
  map: typeof PRODUCT_MAP,
): { name: string; type: "subscription" | "pack" | "coupon" | "unknown" } {
  const match = map.find((p) => Math.abs(p.amount - amount) < 1);
  return match ? { name: match.name, type: match.type } : { name: "Con cupón", type: "coupon" };
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
  const productMap = await resolveProductMap();

  for await (const charge of stripe.charges.list(params)) {
    if (charge.status !== "succeeded") continue;
    const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
    const fee = bt ? bt.fee / 100 : 0;
    const net = bt ? bt.net / 100 : toEuros(charge.amount, charge.currency);
    const amountEur = toEuros(charge.amount, charge.currency);
    const inferred  = inferProduct(amountEur, productMap);
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
  card: "Stripe",
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
  type: "subscription" | "pack" | "coupon" | "unknown";
  revenue: number;
  count: number;
  uniqueCustomers: number;
};

export function stripeByProduct(payments: StripePayment[]): ProductRevenue[] {
  const map = new Map<string, { type: "subscription" | "pack" | "coupon" | "unknown"; revenue: number; count: number; emails: Set<string> }>();
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
    .filter((c) => c.daysSilent >= 35)
    .sort((a, b) => b.daysSilent - a.daysSilent);
}

// Días de vigencia tras el pago, por producto, para considerar al cliente "activo"
const ACTIVE_WINDOW_DAYS: Record<string, number> = {
  "Bàsic": 31,
  "Plus": 31,
  "Pro": 31,
  "Pack Benvinguda": 15,
  "Pack 4 clases": 90,
  "Pack 8 clases": 90,
  "Clase suelta": 30,
};

export type ActiveCustomersRow = {
  month: string;
  label: string;
  count: number;
  subscriptions: number;
  packs: number;
};

/**
 * Clientes activos a cierre de cada mes: el último pago de cada cliente sigue
 * vigente en la fecha de cierre del mes según la ventana de caducidad de su producto
 * (suscripciones 31 días, packs 15–90 días según tipo). Los cupones/importes no
 * reconocidos no cuentan al no tener ventana de vigencia definida.
 *
 * Un cliente con suscripción Y pack vigentes a la vez se cuenta solo en
 * "subscriptions" (categoría prioritaria), para que subscriptions + packs = count.
 */
export function activeCustomersByMonth(payments: StripePayment[]): ActiveCustomersRow[] {
  const dated = payments.filter((p) => (p.customerId ?? p.customerEmail) && ACTIVE_WINDOW_DAYS[p.inferredProduct]);
  if (dated.length === 0) return [];

  const months = Array.from(new Set(dated.map((p) => p.date.slice(0, 7)))).sort();
  const [firstYear, firstMonth] = months[0].split("-").map(Number);
  const now = new Date();
  const lastMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const allMonths: string[] = [];
  let y = firstYear, m = firstMonth;
  while (`${y}-${String(m).padStart(2, "0")}` <= lastMonth) {
    allMonths.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }

  return allMonths.map((month) => {
    const closeDate = new Date(monthEnd(month) + "T23:59:59");
    const activeTypeById = new Map<string, "subscription" | "pack">();
    for (const p of dated) {
      if (p.inferredType !== "subscription" && p.inferredType !== "pack") continue;
      const id = p.customerId ?? p.customerEmail!;
      const windowDays = ACTIVE_WINDOW_DAYS[p.inferredProduct];
      const paidAt = new Date(p.date);
      if (paidAt > closeDate) continue;
      const daysSincePaid = (closeDate.getTime() - paidAt.getTime()) / 86_400_000;
      if (daysSincePaid > windowDays) continue;
      if (p.inferredType === "subscription" || activeTypeById.get(id) !== "subscription") {
        activeTypeById.set(id, p.inferredType);
      }
    }
    const subscriptions = [...activeTypeById.values()].filter((t) => t === "subscription").length;
    const packs = [...activeTypeById.values()].filter((t) => t === "pack").length;
    const [year, mm] = month.split("-");
    return { month, label: `${MONTH_LABELS[mm] ?? mm} ${year}`, count: subscriptions + packs, subscriptions, packs };
  });
}

function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
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

// ── Cached loader (1h, invalidable with revalidateTag('stripe') o el cron de calentamiento) ──

export const loadStripePaymentsCached = unstable_cache(
  () => loadStripePayments(),
  ["stripe-payments"],
  { revalidate: 3600, tags: ["stripe"] },
);

// ── Resumen de pagos por rango de fechas (reembolsos + disputas + errores) ────

export type PaymentsBreakdown = {
  refunded: number;
  disputed: number;
  failed: number;
  refundedIds: string[];   // stripeIds de clientes con reembolso
  disputedIds: string[];   // stripeIds de clientes con disputa
  failedIds:   string[];   // stripeIds de clientes con charge fallido
};

export const loadPaymentsBreakdown = unstable_cache(
  async (fromDate: string, toDate: string): Promise<PaymentsBreakdown> => {
    const fromTs = Math.floor(new Date(fromDate + "T00:00:00").getTime() / 1000);
    const toTs   = Math.floor(new Date(toDate   + "T23:59:59").getTime() / 1000);

    let refunded = 0;
    const refundedSet = new Set<string>();
    for await (const r of stripe.refunds.list({ limit: 100, created: { gte: fromTs, lte: toTs } })) {
      if (r.status !== "succeeded") continue;
      refunded += r.amount / 100;
      const cid = typeof (r as { charge?: unknown }).charge === "string"
        ? (r as { charge: string }).charge
        : null;
      if (cid) refundedSet.add(cid);
    }

    let disputed = 0;
    const disputedSet = new Set<string>();
    for await (const d of stripe.disputes.list({ limit: 100, created: { gte: fromTs, lte: toTs } })) {
      disputed += d.amount / 100;
      const cid = typeof d.charge === "string" ? d.charge : (d.charge as { id: string } | null)?.id ?? null;
      if (cid) disputedSet.add(cid);
    }

    let failed = 0;
    const failedSet = new Set<string>();
    for await (const ch of stripe.charges.list({ limit: 100, created: { gte: fromTs, lte: toTs } })) {
      if (ch.status !== "failed") continue;
      failed += toEuros(ch.amount, ch.currency);
      const cid = typeof ch.customer === "string" ? ch.customer : (ch.customer as { id: string } | null)?.id ?? null;
      if (cid) failedSet.add(cid);
    }

    // Resolver charge IDs a customer IDs para reembolsos y disputas
    const chargeIds = [...refundedSet, ...disputedSet];
    const chargeToCustomer = new Map<string, string>();
    if (chargeIds.length > 0) {
      await Promise.all(
        chargeIds.map(async (chId) => {
          try {
            const ch = await stripe.charges.retrieve(chId);
            const cid = typeof ch.customer === "string" ? ch.customer : null;
            if (cid) chargeToCustomer.set(chId, cid);
          } catch {
            // charge no encontrado, ignorar
          }
        }),
      );
    }

    const refundedCustomerIds = [...new Set([...refundedSet].map((id) => chargeToCustomer.get(id)).filter(Boolean) as string[])];
    const disputedCustomerIds = [...new Set([...disputedSet].map((id) => chargeToCustomer.get(id)).filter(Boolean) as string[])];

    return {
      refunded, disputed, failed,
      refundedIds: refundedCustomerIds,
      disputedIds: disputedCustomerIds,
      failedIds:   [...failedSet],
    };
  },
  ["stripe-payments-breakdown"],
  { revalidate: 3600, tags: ["stripe"] },
);

// ── Compatibility shim: convert to Sale shape for existing charts ──────────────

import { normalizeItem, type Sale } from "./sales";

const STRIPE_METHOD_LABEL: Record<string, string> = {
  card: "Tarjeta",
  sepa_debit: "SEPA",
  paypal: "PayPal",
  link: "Link",
};

// Categoría/producto derivados del importe (misma inferencia que usa ClientesTable),
// no de la descripción cruda de Stripe - Momence no pasa metadatos de producto.
function inferredCategory(type: StripePayment["inferredType"]): string {
  if (type === "subscription") return "Suscripción";
  if (type === "pack") return "Paquete";
  return "Otro";
}

export function toSales(payments: StripePayment[]): Sale[] {
  return payments
    .filter((p): p is StripePayment & { customerEmail: string } => !!p.customerEmail)
    .map((p) => ({
      category: inferredCategory(p.inferredType),
      item: normalizeItem(p.inferredProduct, p.method),
      paymentDate: p.date,
      serviceDate: p.date,
      method: STRIPE_METHOD_LABEL[p.method] ?? p.method,
      amount: p.amount,
      tax: 0,
      email: p.customerEmail.trim().toLowerCase(),
      name: p.customerName,
    }));
}
