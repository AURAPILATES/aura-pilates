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
  paymentErrorReason: string | null; // motivo legible del último fallo de cobro
  paymentErrorDate: string | null; // fecha del fallo más reciente, para saber si un "hablado con clienta" sigue vigente
  paymentErrorAmount: number | null; // importe (€) que Stripe intentó cobrar en el último reintento fallido
  paymentErrorPlan: string | null; // plan/producto del cobro fallido, si se conoce
};

// ── Cached raw customer list from Stripe ──────────────────────────────────────

type RawCustomer = Pick<Stripe.Customer, "id" | "name" | "email" | "created" | "discount" | "delinquent">;

// Traduce el decline_code / code de Stripe a un motivo legible en español
const DECLINE_CODE_LABELS: Record<string, string> = {
  insufficient_funds: "Fondos insuficientes",
  card_declined: "Tarjeta rechazada",
  expired_card: "Tarjeta caducada",
  incorrect_cvc: "CVC incorrecto",
  processing_error: "Error de procesamiento",
  generic_decline: "Tarjeta rechazada",
  do_not_honor: "Tarjeta rechazada por el banco",
  lost_card: "Tarjeta reportada como perdida",
  stolen_card: "Tarjeta reportada como robada",
  fraudulent: "Marcada como fraude",
  pickup_card: "Tarjeta retenida por el banco",
  authentication_required: "Requiere autenticación adicional",
};

function describePaymentError(err: Stripe.PaymentIntent.LastPaymentError | null | undefined): string | null {
  if (!err) return null;
  const code = (err as { decline_code?: string }).decline_code ?? err.code ?? null;
  if (code && DECLINE_CODE_LABELS[code]) return DECLINE_CODE_LABELS[code];
  return err.message ?? "Cobro fallido";
}

// Plan/producto de una factura fallida, si se puede deducir de sus líneas.
// Cogemos la línea de mayor importe (evita quedarnos con un ajuste de prorrateo) y
// preferimos el nickname del precio ("Plus"), luego el del plan, y por último la
// descripción de la línea (más verbosa). Best-effort: puede ser null.
function invoicePlanLabel(inv: Stripe.Invoice): string | null {
  const lines = (inv.lines?.data ?? []) as unknown as {
    amount?: number | null;
    description?: string | null;
    price?: { nickname?: string | null } | null;
    plan?: { nickname?: string | null } | null;
  }[];
  if (lines.length === 0) return null;
  const line = lines.reduce((a, b) => ((b.amount ?? 0) > (a.amount ?? 0) ? b : a));
  return line.price?.nickname ?? line.plan?.nickname ?? line.description ?? null;
}

type FailedPayment = { failedAt: string; reason: string | null; amount: number | null; plan: string | null };

// Pagos fallidos en los últimos 30 días: devuelve customerId + fecha, motivo, importe
// y plan del reintento fallido más reciente
export const fetchFailedPayments = unstable_cache(
  async (): Promise<({ customerId: string } & FailedPayment)[]> => {
    const cutoff = Math.floor(Date.now() / 1000) - 30 * 86400;
    const map = new Map<string, FailedPayment>(); // stripeId → fallo más reciente

    const toDate = (ts: number) => new Date(ts * 1000).toISOString().split("T")[0];
    const setIfNewer = (cid: string, v: FailedPayment) => {
      const ex = map.get(cid);
      if (!ex || v.failedAt > ex.failedAt) map.set(cid, v);
    };

    // Facturas abiertas que Stripe ya intentó cobrar
    for await (const inv of stripe.invoices.list({
      status: "open",
      limit: 100,
      created: { gte: cutoff },
      expand: ["data.payment_intent"],
    })) {
      if (!inv.attempted) continue;
      const cid = typeof inv.customer === "string" ? inv.customer : (inv.customer as Stripe.Customer | null)?.id ?? null;
      if (!cid) continue;
      const pi = (inv as unknown as { payment_intent?: Stripe.PaymentIntent | string | null }).payment_intent;
      const reason = pi && typeof pi !== "string" ? describePaymentError(pi.last_payment_error) : null;
      const cents = inv.amount_due ?? inv.total ?? null;
      setIfNewer(cid, {
        failedAt: toDate(inv.created),
        reason: reason ?? "Factura no cobrada",
        amount: typeof cents === "number" ? cents / 100 : null,
        plan: invoicePlanLabel(inv),
      });
    }

    // PaymentIntents fallidos (requires_payment_method + last_payment_error)
    for await (const pi of stripe.paymentIntents.list({ limit: 100, created: { gte: cutoff } })) {
      if (pi.status !== "requires_payment_method" || !pi.last_payment_error) continue;
      const cid = typeof pi.customer === "string" ? pi.customer : (pi.customer as Stripe.Customer | null)?.id ?? null;
      if (cid) setIfNewer(cid, {
        failedAt: toDate(pi.created),
        reason: describePaymentError(pi.last_payment_error),
        amount: typeof pi.amount === "number" ? pi.amount / 100 : null,
        plan: pi.description ?? null,
      });
    }

    return [...map.entries()].map(([customerId, v]) => ({ customerId, ...v }));
  },
  ["stripe-failed-payments"],
  { revalidate: 3600, tags: ["stripe"] },
);

export const fetchStripeCustomerList = unstable_cache(
  async (): Promise<RawCustomer[]> => {
    const result: RawCustomer[] = [];
    for await (const raw of stripe.customers.list({ limit: 100, expand: ["data.discount.coupon"] })) {
      if ((raw as unknown as { deleted?: boolean }).deleted) continue;
      result.push(raw as Stripe.Customer);
    }
    return result;
  },
  ["stripe-customer-list"],
  { revalidate: 3600, tags: ["stripe"] },
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
    paymentErrorReason: string | null;
    paymentErrorDate: string | null;
    paymentErrorAmount: number | null;
    paymentErrorPlan: string | null;
  };

  // Último pago exitoso por stripeId (ya tenemos los pagos cargados)
  const lastSuccessMap = new Map<string, string>();
  for (const p of payments) {
    if (!p.customerId) continue;
    const ex = lastSuccessMap.get(p.customerId);
    if (!ex || p.date > ex) lastSuccessMap.set(p.customerId, p.date);
  }

  const [stripeCustomers, failedPayments] = await Promise.all([
    fetchStripeCustomerList(),
    fetchFailedPayments(),
  ]);
  const failedByStripeId = new Map(failedPayments.map((f) => [f.customerId, f]));
  const raw_customers: RawEntry[] = [];

  for (const c of stripeCustomers) {
    const stats = byCustomer.get(c.id);
    if (!stats) continue;

    const rawDiscount = c.discount as unknown as { coupon?: { id: string; name?: string | null; percent_off?: number | null; amount_off?: number | null } } | null;
    const disc = rawDiscount?.coupon ?? null;
    const discount: StripeDiscount | null = disc
      ? { name: disc.name ?? disc.id ?? "Descuento", percentOff: disc.percent_off ?? null, amountOff: disc.amount_off ? disc.amount_off / 100 : null }
      : null;

    const failed = failedByStripeId.get(c.id) ?? null;
    const hasPaymentError = (() => {
      if (c.delinquent) return true;
      if (!failed) return false;
      // Resuelto si hay un pago exitoso posterior al fallo
      const lastSuccess = lastSuccessMap.get(c.id);
      return !lastSuccess || lastSuccess < failed.failedAt;
    })();

    raw_customers.push({
      id: c.id,
      name: c.name ?? null,
      email: c.email ?? null,
      createdAt: new Date(c.created * 1000).toISOString().split("T")[0],
      discount,
      stats,
      isRecurring: recurring.has(c.id),
      delinquent: c.delinquent ?? false,
      hasPaymentError,
      paymentErrorReason: hasPaymentError ? (failed?.reason ?? (c.delinquent ? "Cuenta morosa en Stripe" : null)) : null,
      paymentErrorDate: hasPaymentError ? (failed?.failedAt ?? null) : null,
      paymentErrorAmount: hasPaymentError ? (failed?.amount ?? null) : null,
      paymentErrorPlan: hasPaymentError ? (failed?.plan ?? null) : null,
    });
  }

  // Merge duplicate emails - keep oldest createdAt as primary id
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
    // Todos los datos del error (motivo, fecha, importe, plan) vienen de la MISMA entrada,
    // para que sean coherentes entre sí.
    const errEntry = group.find((r) => r.hasPaymentError) ?? null;
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
      paymentErrorReason: errEntry?.paymentErrorReason ?? null,
      paymentErrorDate: errEntry?.paymentErrorDate ?? null,
      paymentErrorAmount: errEntry?.paymentErrorAmount ?? null,
      paymentErrorPlan: errEntry?.paymentErrorPlan ?? null,
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
