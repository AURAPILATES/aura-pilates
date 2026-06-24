import { NextResponse } from "next/server";
import { loadTransactionsCached } from "@/lib/transactions";
import { loadRecurringExpensesCached } from "@/lib/recurringExpenses";
import { findRecurringSeries } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export async function GET() {
  const [transactions, expenses] = await Promise.all([
    loadTransactionsCached(null, null),
    loadRecurringExpensesCached(),
  ]);
  const expenseKeys = new Set(expenses.map((e) => e.key));
  const count = findRecurringSeries(transactions).filter((s) => !expenseKeys.has(s.key)).length;
  return NextResponse.json({ count });
}
