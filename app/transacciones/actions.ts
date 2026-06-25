"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidateTag } from "next/cache";
import type { PaymentMethod } from "@/lib/transactions";
import { loadCategories, type Category } from "@/lib/categories";
import { contactKeyFor } from "@/lib/contactRules";

export type ImportRow = {
  date: string;
  amount: number;
  balance: number | null;
  concept: string | null;
  contact: string | null;
};

type ContactRuleRow = {
  contact_key: string;
  label: string;
  category: string | null;
  iva_rate: number;
  retencion_rate: number;
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

/** Aplica la regla del contacto (si existe): categoría y etiqueta tienen prioridad sobre el
 * auto-categorizado por palabra clave, y copia iva_rate/retencion_rate al movimiento. */
function buildRowInsert(
  rulesByKey: Map<string, ContactRuleRow>,
  autoCategory: (row: ImportRow) => string | null,
) {
  return function (row: ImportRow) {
    const rule = rulesByKey.get(contactKeyFor(row.concept, row.contact));
    return {
      date: row.date,
      amount: row.amount,
      balance: row.balance,
      concept: row.concept,
      contact: row.contact?.trim() || rule?.label || null,
      category: rule?.category ?? autoCategory(row),
      iva_rate: rule ? rule.iva_rate : null,
      retencion_rate: rule ? rule.retencion_rate : null,
    };
  };
}

async function loadContactRulesMap(
  supabase: ReturnType<typeof createServerClient>,
): Promise<Map<string, ContactRuleRow>> {
  const { data } = await supabase
    .from("contact_rules")
    .select("contact_key, label, category, iva_rate, retencion_rate");
  return new Map((data ?? []).map((r: ContactRuleRow) => [r.contact_key, r]));
}

export async function getKnownContactKeys(): Promise<string[]> {
  const supabase = createServerClient();
  const { data } = await supabase.from("contact_rules").select("contact_key");
  return (data ?? []).map((r: { contact_key: string }) => r.contact_key);
}

export async function getCategoriesForImport(): Promise<Category[]> {
  return loadCategories();
}

export type ContactRule = {
  id: number;
  contactKey: string;
  label: string;
  category: string | null;
  ivaRate: number;
  retencionRate: number;
};

export async function getContactRules(): Promise<ContactRule[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("contact_rules")
    .select("id, contact_key, label, category, iva_rate, retencion_rate")
    .order("label", { ascending: true });
  return (data ?? []).map((r: { id: number; contact_key: string; label: string; category: string | null; iva_rate: number; retencion_rate: number }) => ({
    id: r.id,
    contactKey: r.contact_key,
    label: r.label,
    category: r.category,
    ivaRate: r.iva_rate,
    retencionRate: r.retencion_rate,
  }));
}

export async function createContactRule(input: {
  contactKey: string;
  label: string;
  category: string | null;
  ivaRate: number;
  retencionRate: number;
}): Promise<ContactRule> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("contact_rules")
    .upsert(
      {
        contact_key: input.contactKey,
        label: input.label,
        category: input.category,
        iva_rate: input.ivaRate,
        retencion_rate: input.retencionRate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "contact_key" },
    )
    .select("id, contact_key, label, category, iva_rate, retencion_rate")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    contactKey: data.contact_key,
    label: data.label,
    category: data.category,
    ivaRate: data.iva_rate,
    retencionRate: data.retencion_rate,
  };
}

export async function updateContactRule(
  id: number,
  patch: { label?: string; category?: string | null; ivaRate?: number; retencionRate?: number },
): Promise<void> {
  const supabase = createServerClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.ivaRate !== undefined) update.iva_rate = patch.ivaRate;
  if (patch.retencionRate !== undefined) update.retencion_rate = patch.retencionRate;
  const { error } = await supabase.from("contact_rules").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteContactRule(id: number): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("contact_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Aplica retroactivamente una regla de contacto a los movimientos ya importados que
 * coincidan con su clave, por si la regla se creó o cambió después de importarlos. */
export async function applyContactRuleToExisting(contactKey: string): Promise<{ updated: number }> {
  const supabase = createServerClient();
  const { data: rule } = await supabase
    .from("contact_rules")
    .select("label, category, iva_rate, retencion_rate")
    .eq("contact_key", contactKey)
    .single();
  if (!rule) return { updated: 0 };

  const { data: txns } = await supabase
    .from("transactions")
    .select("id, concept, contact")
    .is("deleted_at", null);

  const matchingIds = (txns ?? [])
    .filter((t: { id: string; concept: string | null; contact: string | null }) => contactKeyFor(t.concept, t.contact) === contactKey)
    .map((t: { id: string }) => t.id);
  if (matchingIds.length === 0) return { updated: 0 };

  const { error } = await supabase
    .from("transactions")
    .update({ category: rule.category, iva_rate: rule.iva_rate, retencion_rate: rule.retencion_rate })
    .in("id", matchingIds);
  if (error) throw new Error(error.message);

  revalidateTag("transactions");
  return { updated: matchingIds.length };
}

export async function saveContactRules(
  rules: { contactKey: string; label: string; category: string | null; ivaRate: number; retencionRate: number }[],
): Promise<void> {
  if (!rules.length) return;
  const supabase = createServerClient();
  const { error } = await supabase.from("contact_rules").upsert(
    rules.map((r) => ({
      contact_key: r.contactKey,
      label: r.label,
      category: r.category,
      iva_rate: r.ivaRate,
      retencion_rate: r.retencionRate,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "contact_key" },
  );
  if (error) throw new Error(error.message);
}

export async function importTransactions(
  rows: ImportRow[],
  paymentMethod: PaymentMethod = "banco",
): Promise<{ imported: number; skipped: number; skippedRows: ImportRow[]; batchId: string }> {
  if (rows.length === 0) return { imported: 0, skipped: 0, skippedRows: [], batchId: "" };
  const batchId = crypto.randomUUID();
  const supabase = createServerClient();

  const [{ data: cats }, rulesByKey] = await Promise.all([
    supabase.from("categories").select("value, auto_keywords"),
    loadContactRulesMap(supabase),
  ]);
  const autoCategory = buildAutoCategory(cats ?? []);
  const buildRow = buildRowInsert(rulesByKey, autoCategory);

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
    ...buildRow(r),
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
  const [{ data: cats }, rulesByKey] = await Promise.all([
    supabase.from("categories").select("value, auto_keywords"),
    loadContactRulesMap(supabase),
  ]);
  const autoCategory = buildAutoCategory(cats ?? []);
  const buildRow = buildRowInsert(rulesByKey, autoCategory);

  const toInsert = rows.map((r) => ({
    ...buildRow(r),
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

export async function updateTransactionDate(id: string, date: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ date })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
}

export async function updateTransactionPaymentMethod(id: string, paymentMethod: PaymentMethod) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ payment_method: paymentMethod })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
}
