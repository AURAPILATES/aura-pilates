"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import type { PaymentMethod } from "@/lib/transactions";

export type ImportRow = {
  date: string;
  amount: number;
  balance: number | null;
  concept: string | null;
  contact: string | null;
};

export async function importTransactions(
  rows: ImportRow[],
  paymentMethod: PaymentMethod = "banco",
): Promise<{ imported: number; skipped: number }> {
  if (rows.length === 0) return { imported: 0, skipped: 0 };
  const supabase = createServerClient();

  // Categories for auto-assignment
  const { data: cats } = await supabase.from("categories").select("value, auto_keywords");
  const categories = cats ?? [];

  function autoCategory(row: ImportRow): string {
    const hay = `${row.concept ?? ""} ${row.contact ?? ""}`.toLowerCase();
    for (const cat of categories) {
      if (!cat.auto_keywords) continue;
      const kws = cat.auto_keywords.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean);
      if (kws.some((kw: string) => hay.includes(kw))) return cat.value;
    }
    return "Otros";
  }

  // Deduplicate: load existing in same date range
  const dates = rows.map((r) => r.date).sort();
  const { data: existing } = await supabase
    .from("transactions")
    .select("date, amount, concept, payment_method")
    .gte("date", dates[0])
    .lte("date", dates[dates.length - 1]);

  const seen = new Set(
    (existing ?? []).map(
      (t: { date: string; amount: number; concept: string | null; payment_method: string }) =>
        `${t.date}|${t.amount}|${(t.concept ?? "").toLowerCase().slice(0, 50)}|${t.payment_method}`,
    ),
  );

  const toInsert = rows
    .filter((r) => !seen.has(`${r.date}|${r.amount}|${(r.concept ?? "").toLowerCase().slice(0, 50)}|${paymentMethod}`))
    .map((r) => ({
      date: r.date,
      amount: r.amount,
      balance: r.balance,
      concept: r.concept,
      contact: r.contact,
      category: autoCategory(r),
      source: "csv-import",
      payment_method: paymentMethod,
    }));

  const skipped = rows.length - toInsert.length;

  if (toInsert.length > 0) {
    const { error } = await supabase.from("transactions").insert(toInsert);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/transacciones");
  revalidatePath("/finanzas");
  return { imported: toInsert.length, skipped };
}

export async function addCashTransaction(input: {
  date: string;
  amount: number;
  concept: string;
  category: string;
}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("transactions").insert({
    date: input.date,
    amount: input.amount,
    balance: null,
    concept: input.concept.trim() || null,
    contact: null,
    category: input.category,
    source: "manual",
    payment_method: "efectivo",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/transacciones");
  revalidatePath("/finanzas");
}

export async function updateTransactionCategory(id: string, category: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ category })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/transacciones");
  revalidatePath("/finanzas");
}

export async function updateTransactionContactType(id: string, contactType: string | null) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ contact_type: contactType || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/transacciones");
}

export async function updateTransactionNotes(id: string, notes: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ notes: notes.trim() || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/transacciones");
}
