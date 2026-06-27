import type { StripePayment } from "./stripePayments";
import type { Sale } from "./sales";
import { expensesByMonth, type Transaction } from "./transactions";
import type { Category } from "./categories";

const MONTH_LABELS: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

export type BreakevenPoint = {
  month: string;        // "YYYY-MM"
  label: string;        // "Ene 2026"
  revenue: number;       // ingresos del mes (Stripe + Urban Sports Club)
  expenses: number;      // gastos del mes (operacionales + inversión inicial)
  cumRevenue: number;
  cumExpenses: number;
  cumNet: number;        // cumRevenue - cumExpenses
};

// Ingresos totales desde el inicio: Stripe (todo, no solo suscripciones) + Urban Sports Club
// (USC paga por transferencia mensual, registrado en el CSV de Momence, no en Stripe).
// Gastos: operacionales + inversión inicial (mismas categorías que el resto de Finanzas).
export function computeBreakeven(
  payments: StripePayment[],
  sales: Sale[],
  txns: Transaction[],
  categories: Category[],
): BreakevenPoint[] {
  const revByMonth = new Map<string, number>();
  for (const p of payments) {
    const m = p.date.slice(0, 7);
    revByMonth.set(m, (revByMonth.get(m) ?? 0) + p.amount);
  }
  for (const s of sales) {
    if (s.method !== "urban-sports-club") continue;
    const m = s.paymentDate.slice(0, 7);
    revByMonth.set(m, (revByMonth.get(m) ?? 0) + s.amount);
  }

  const expByMonth = expensesByMonth(txns, categories);
  const months = [...new Set([...revByMonth.keys(), ...expByMonth.keys()])].sort();

  let cumRevenue = 0;
  let cumExpenses = 0;
  return months.map((m) => {
    const revenue = revByMonth.get(m) ?? 0;
    const expenses = expByMonth.get(m) ?? 0;
    cumRevenue += revenue;
    cumExpenses += expenses;
    const [y, mm] = m.split("-");
    return {
      month: m,
      label: `${MONTH_LABELS[mm] ?? mm} ${y}`,
      revenue,
      expenses,
      cumRevenue,
      cumExpenses,
      cumNet: cumRevenue - cumExpenses,
    };
  });
}

// Primer mes en el que el resultado neto acumulado pasa a ser positivo (o sigue siéndolo).
export function breakevenMonth(points: BreakevenPoint[]): string | null {
  const hit = points.find((p) => p.cumNet >= 0);
  return hit?.month ?? null;
}
