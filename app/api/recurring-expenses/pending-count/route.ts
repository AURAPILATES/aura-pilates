import { NextResponse } from "next/server";
import { loadTransactionsCached } from "@/lib/transactions";
import { loadRecurringExpensesCached } from "@/lib/recurringExpenses";
import { loadCategoriesCached } from "@/lib/categories";
import { computePendingRecurring } from "@/lib/recurring";
import { getContacts } from "@/app/transacciones/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const [transactions, expenses, categories, contacts] = await Promise.all([
    loadTransactionsCached(null, null),
    loadRecurringExpensesCached(),
    loadCategoriesCached(),
    getContacts(),
  ]);
  const count = computePendingRecurring(transactions, categories, expenses, contacts).length;
  return NextResponse.json({ count });
}
