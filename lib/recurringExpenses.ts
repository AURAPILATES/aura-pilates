import { createServerClient } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { findRecurringSeries, projectNextDate, type RecurringForecast } from "@/lib/recurring";
import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";

export type RecurringExpenseStatus = "confirmed" | "ignored" | "cancelled";
export type RecurringExpenseEndType = "never" | "date" | "count";

export type RecurringExpense = {
  id: number;
  key: string;
  label: string;
  category: string | null;
  period: string;
  period_days: number;
  amount: number; // negativo
  iva_rate: number;
  retencion_rate: number;
  contact_id: number | null;
  status: RecurringExpenseStatus;
  end_type: RecurringExpenseEndType;
  end_date: string | null;
  end_count: number | null;
  notes: string | null;
  /** Dado de alta a mano, sin transacción real detrás todavía (ver createManualRecurringExpense
   * en recurringActions.ts) - para anticipar un gasto futuro conocido. */
  manual: boolean;
  /** Fecha de referencia (último pago conocido o próximo previsto) desde la que proyectar,
   * solo relevante mientras no haya transacciones reales que lo respalden. */
  anchor_date: string | null;
  created_at: string;
  updated_at: string;
};

export async function loadRecurringExpenses(): Promise<RecurringExpense[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data as RecurringExpense[];
}

export const loadRecurringExpensesCached = unstable_cache(
  loadRecurringExpenses,
  ["recurring_expenses"],
  { revalidate: 300, tags: ["recurring_expenses"] },
);

/**
 * Previsión de cashflow basada solo en gastos recurrentes confirmados manualmente en
 * Transacciones › Recurrentes (no en la heurística cruda), para que el cashflow refleje
 * decisiones humanas en vez de falsos positivos/negativos del algoritmo de detección.
 */
export function forecastConfirmedExpenses(
  expenses: RecurringExpense[],
  transactions: Transaction[],
  referenceDate?: string,
  categories?: Category[],
): RecurringForecast[] {
  const seriesByKey = new Map(findRecurringSeries(transactions, categories).map((s) => [s.key, s]));
  const result: RecurringForecast[] = [];

  for (const e of expenses) {
    if (e.status !== "confirmed") continue;
    // Solo gastos: PrevisionGastos sólo maneja importes negativos (usa Math.abs y los suma como
    // "comprometido"), así que un ingreso recurrente confirmado aquí se contaría como un pago más
    // en vez de como entrada. Los ingresos recurrentes se ven y gestionan en Transacciones ›
    // Recurrentes, pero no alimentan esta previsión.
    if (e.amount >= 0) continue;
    const s = seriesByKey.get(e.key);
    const occurrences = s?.transactions.length ?? 0;
    // Sin transacciones reales todavía, un recurrente manual proyecta desde su fecha de
    // referencia en vez de desaparecer de la previsión (ver createManualRecurringExpense).
    const lastDate = s ? s.transactions[s.transactions.length - 1].date : e.anchor_date;
    if (!lastDate) continue;
    if (e.end_type === "count" && e.end_count != null && occurrences >= e.end_count) continue;
    const { nextDate, daysUntil } = projectNextDate(lastDate, e.period_days, referenceDate);
    if (e.end_type === "date" && e.end_date && nextDate > e.end_date) continue;
    result.push({
      key: e.key,
      label: e.label,
      category: e.category,
      period: e.period,
      amount: e.amount,
      lastDate,
      nextDate,
      daysUntil,
      occurrences,
    });
  }

  return result.sort((a, b) => a.daysUntil - b.daysUntil);
}
