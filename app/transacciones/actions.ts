"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidateTag } from "next/cache";
import type { PaymentMethod } from "@/lib/transactions";

export type ImportRow = {
  date: string;
  amount: number;
  balance: number | null;
  concept: string | null;
  contact: string | null;
};

function buildAutoCategory(categories: { value: string; auto_keywords: string | null }[]) {
  return function (row: ImportRow): string | null {
    const hay = `${row.concept ?? ""} ${row.contact ?? ""}`.toLowerCase();
    for (const cat of categories) {
      if (!cat.auto_keywords) continue;
      const kws = cat.auto_keywords.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean);
      if (kws.some((kw: string) => hay.includes(kw))) return cat.value;
    }
    return null;
  };
}

export async function importTransactions(
  rows: ImportRow[],
  paymentMethod: PaymentMethod = "banco",
): Promise<{ imported: number; skipped: number; skippedRows: ImportRow[]; batchId: string }> {
  if (rows.length === 0) return { imported: 0, skipped: 0, skippedRows: [], batchId: "" };
  const batchId = crypto.randomUUID();
  const supabase = createServerClient();

  const { data: cats } = await supabase.from("categories").select("value, auto_keywords");
  const autoCategory = buildAutoCategory(cats ?? []);

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

  const skippedRows: ImportRow[] = [];
  const filteredRows = rows.filter((r) => {
    const key = `${r.date}|${r.amount}|${(r.concept ?? "").toLowerCase().slice(0, 50)}|${paymentMethod}`;
    if (seen.has(key)) { skippedRows.push(r); return false; }
    return true;
  });
  const toInsert = filteredRows.map((r) => ({
    date: r.date,
    amount: r.amount,
    balance: r.balance,
    concept: r.concept,
    contact: r.contact,
    category: autoCategory(r),
    source: "csv-import",
    payment_method: paymentMethod,
    import_batch_id: batchId,
  }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("transactions").insert(toInsert);
    if (error) throw new Error(error.message);
  }

  revalidateTag("transactions");
  return { imported: toInsert.length, skipped: skippedRows.length, skippedRows, batchId };
}

export async function forceImportTransactions(
  rows: ImportRow[],
  paymentMethod: PaymentMethod,
  batchId: string,
): Promise<void> {
  if (!rows.length) return;
  const supabase = createServerClient();
  const { data: cats } = await supabase.from("categories").select("value, auto_keywords");
  const autoCategory = buildAutoCategory(cats ?? []);

  const toInsert = rows.map((r) => ({
    date: r.date,
    amount: r.amount,
    balance: r.balance,
    concept: r.concept,
    contact: r.contact,
    category: autoCategory(r),
    source: "csv-import",
    payment_method: paymentMethod,
    import_batch_id: batchId,
  }));

  const { error } = await supabase.from("transactions").insert(toInsert);
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
}

export type ImportBatch = {
  batchId: string;
  count: number;
  minDate: string;
  maxDate: string;
  paymentMethod: string;
};

export async function getRecentImports(): Promise<ImportBatch[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("transactions")
    .select("import_batch_id, date, payment_method")
    .not("import_batch_id", "is", null)
    .order("date", { ascending: false });

  const byBatch = new Map<string, { dates: string[]; paymentMethod: string }>();
  for (const row of data ?? []) {
    const bid = row.import_batch_id as string;
    if (!byBatch.has(bid)) byBatch.set(bid, { dates: [], paymentMethod: row.payment_method ?? "banco" });
    byBatch.get(bid)!.dates.push(row.date);
  }

  return [...byBatch.entries()]
    .map(([batchId, { dates, paymentMethod }]) => ({
      batchId,
      count: dates.length,
      maxDate: dates[0],
      minDate: dates[dates.length - 1],
      paymentMethod,
    }))
    .slice(0, 8);
}

export async function undoImport(batchId: string): Promise<{ deleted: number }> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("import_batch_id", batchId)
    .select("id");
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
  return { deleted: data?.length ?? 0 };
}

export async function addCashTransaction(input: {
  date: string;
  amount: number;
  concept: string;
  category: string | null;
  notes?: string;
  paymentMethod?: PaymentMethod;
}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("transactions").insert({
    date: input.date,
    amount: input.amount,
    balance: null,
    concept: input.concept.trim() || null,
    contact: null,
    category: input.category,
    notes: input.notes?.trim() || null,
    source: "manual",
    payment_method: input.paymentMethod ?? "efectivo",
  });
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
}

export async function updateTransactionCategory(id: string, category: string | null) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ category: category || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
}

export async function softDeleteTransactions(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
}

export async function restoreTransactions(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: null })
    .in("id", ids);
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
}

export type DeletedTransaction = {
  id: string;
  date: string;
  amount: number;
  concept: string | null;
  contact: string | null;
  category: string | null;
  payment_method: string;
  deleted_at: string;
};

export async function loadDeletedTransactions(): Promise<DeletedTransaction[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("transactions")
    .select("id, date, amount, concept, contact, category, payment_method, deleted_at")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  return (data ?? []) as DeletedTransaction[];
}

export async function updateTransactionConcept(id: string, concept: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ concept: concept.trim() || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
}

export async function updateTransactionContact(id: string, contact: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ contact: contact.trim() || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
}

export async function updateTransactionNotes(id: string, notes: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ notes: notes.trim() || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
}
