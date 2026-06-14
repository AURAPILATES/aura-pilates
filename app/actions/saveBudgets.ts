"use server";
import { saveBudgets } from "@/lib/budgets";
import type { Budget } from "@/lib/budgets";

export async function saveBudgetsAction(budgets: Budget[]) {
  saveBudgets(budgets);
}
