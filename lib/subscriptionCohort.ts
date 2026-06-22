import type { StripePayment } from "./stripePayments";
import type { SubscriptionTier } from "./mrr";

const MONTH_LABELS: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

const PRICE_TOLERANCE = 2; // € — mismo margen que en el resto de matching por precio

export type MonthlySubStats = {
  month: string;   // "YYYY-MM"
  label: string;   // "Feb 2026"
  revenue: number;
  activeCount: number;
  newSubs: number;
  churned: number;
  reactivated: number;
};

function isSubscriptionAmount(amount: number, tiers: SubscriptionTier[]): boolean {
  return tiers.some((t) => Math.abs(amount - t.price) <= PRICE_TOLERANCE);
}

// Reconstruye altas/bajas/reactivaciones mes a mes a partir del historial completo
// de cobros de Stripe (con customerId), identificando qué cobros son de suscripción
// por su importe contra el catálogo de Momence. No depende de CSV ni de snapshots:
// Stripe ya tiene el histórico completo desde el inicio.
//
// `primaryIdMap` (stripeId en bruto → id de cliente fusionado por email) agrupa los pagos
// por persona real en vez de por perfil de Stripe; si se omite, agrupa por stripeId en bruto.
export function computeSubscriptionCohorts(
  payments: StripePayment[],
  tiers: SubscriptionTier[],
  primaryIdMap?: Map<string, string>,
): MonthlySubStats[] {
  const subPayments = payments.filter((p) => p.customerId && isSubscriptionAmount(p.amount, tiers));

  const monthsByCustomer = new Map<string, Set<string>>();
  const revenueByMonth = new Map<string, number>();
  for (const p of subPayments) {
    const id = primaryIdMap?.get(p.customerId!) ?? p.customerId!;
    const m = p.date.slice(0, 7);
    const set = monthsByCustomer.get(id) ?? new Set<string>();
    set.add(m);
    monthsByCustomer.set(id, set);
    revenueByMonth.set(m, (revenueByMonth.get(m) ?? 0) + p.amount);
  }

  const allMonths = Array.from(revenueByMonth.keys()).sort();

  return allMonths.map((month, idx) => {
    const prevMonth = idx > 0 ? allMonths[idx - 1] : null;
    let newSubs = 0;
    let reactivated = 0;
    let activeCount = 0;

    for (const months of monthsByCustomer.values()) {
      if (!months.has(month)) continue;
      activeCount++;
      const paidBefore = Array.from(months).some((m) => m < month);
      if (!paidBefore) {
        newSubs++;
      } else if (prevMonth && !months.has(prevMonth)) {
        reactivated++;
      }
    }

    let churned = 0;
    if (prevMonth) {
      for (const months of monthsByCustomer.values()) {
        if (months.has(prevMonth) && !months.has(month)) churned++;
      }
    }

    const [y, mm] = month.split("-");
    return {
      month,
      label: `${MONTH_LABELS[mm] ?? mm} ${y}`,
      revenue: revenueByMonth.get(month) ?? 0,
      activeCount,
      newSubs,
      churned,
      reactivated,
    };
  });
}

export type RetentionCohortRow = {
  month: string;   // "YYYY-MM" — mes de la primera suscripción de la cohorte
  label: string;   // "Feb 2026"
  n: number;       // tamaño de la cohorte
  values: Array<number | null>; // % retención en M+1, M+2, ... (null = mes aún no transcurrido)
};

function addMonths(ym: string, k: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// % de cada cohorte de nuevos suscriptores (agrupados por su primer mes de pago) que
// sigue pagando en M+1, M+2... Usa el mismo histórico de Stripe que computeSubscriptionCohorts.
// `primaryIdMap`: ver computeSubscriptionCohorts.
export function computeRetentionCohorts(
  payments: StripePayment[],
  tiers: SubscriptionTier[],
  maxOffset = 4,
  primaryIdMap?: Map<string, string>,
): RetentionCohortRow[] {
  const subPayments = payments.filter((p) => p.customerId && isSubscriptionAmount(p.amount, tiers));
  if (subPayments.length === 0) return [];

  const monthsByCustomer = new Map<string, Set<string>>();
  for (const p of subPayments) {
    const id = primaryIdMap?.get(p.customerId!) ?? p.customerId!;
    const m = p.date.slice(0, 7);
    const set = monthsByCustomer.get(id) ?? new Set<string>();
    set.add(m);
    monthsByCustomer.set(id, set);
  }

  const firstMonthByCustomer = new Map<string, string>();
  for (const [id, months] of monthsByCustomer) {
    firstMonthByCustomer.set(id, Array.from(months).sort()[0]);
  }

  const cohortCustomers = new Map<string, string[]>();
  for (const [id, firstMonth] of firstMonthByCustomer) {
    const list = cohortCustomers.get(firstMonth) ?? [];
    list.push(id);
    cohortCustomers.set(firstMonth, list);
  }

  const lastDataMonth = Array.from(new Set(subPayments.map((p) => p.date.slice(0, 7)))).sort().slice(-1)[0];
  const cohortMonths = Array.from(cohortCustomers.keys()).sort();

  return cohortMonths.map((month) => {
    const ids = cohortCustomers.get(month)!;
    const n = ids.length;
    const values: Array<number | null> = [];
    for (let k = 1; k <= maxOffset; k++) {
      const targetMonth = addMonths(month, k);
      if (targetMonth > lastDataMonth) {
        values.push(null);
        continue;
      }
      const retained = ids.filter((id) => monthsByCustomer.get(id)!.has(targetMonth)).length;
      values.push(n > 0 ? Math.round((retained / n) * 100) : 0);
    }
    const [y, mm] = month.split("-");
    return { month, label: `${MONTH_LABELS[mm] ?? mm} ${y}`, n, values };
  });
}
