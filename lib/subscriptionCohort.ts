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
export function computeSubscriptionCohorts(payments: StripePayment[], tiers: SubscriptionTier[]): MonthlySubStats[] {
  const subPayments = payments.filter((p) => p.customerId && isSubscriptionAmount(p.amount, tiers));

  const monthsByCustomer = new Map<string, Set<string>>();
  const revenueByMonth = new Map<string, number>();
  for (const p of subPayments) {
    const m = p.date.slice(0, 7);
    const set = monthsByCustomer.get(p.customerId!) ?? new Set<string>();
    set.add(m);
    monthsByCustomer.set(p.customerId!, set);
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
