import { createServerClient } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { findRecurringSeries, projectNextDate, type RecurringForecast } from "@/lib/recurring";
import type { Transaction } from "@/lib/transactions";

export type RecurringExpenseStatus = "confirmed" | "ignored" | "cancelled";

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
  status: RecurringExpenseStatus;
  notes: string | null;
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
 * /gastos-recurrentes (no en la heurística cruda), para que el cashflow refleje decisiones
 * humanas en vez de falsos positivos/negativos del algoritmo de detección.
 */
export function forecastConfirmedExpenses(
  expenses: RecurringExpense[],
  transactions: Transaction[],
  referenceDate?: string,
): RecurringForecast[] {
  const seriesByKey = new Map(findRecurringSeries(transactions).map((s) => [s.key, s]));
  const result: RecurringForecast[] = [];

  for (const e of expenses) {
    if (e.status !== "confirmed") continue;
    const s = seriesByKey.get(e.key);
    const lastDate = s ? s.transactions[s.transactions.length - 1].date : null;
    if (!lastDate) continue; // sin movimientos que lo respalden todavía
    const { nextDate, daysUntil } = projectNextDate(lastDate, e.period_days, referenceDate);
    result.push({
      key: e.key,
      label: e.label,
      category: e.category,
      period: e.period,
      amount: e.amount,
      lastDate,
      nextDate,
      daysUntil,
      occurrences: s!.transactions.length,
    });
  }

  return result.sort((a, b) => a.daysUntil - b.daysUntil);
}
