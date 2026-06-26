"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath, revalidateTag } from "next/cache";
import type { PaymentMethod, Transaction } from "@/lib/transactions";
import { loadCategories, type Category } from "@/lib/categories";
import { contactKeyFor } from "@/lib/contactRules";
import { PERIOD_BUCKETS, displayLabel, seriesKeyFor } from "@/lib/recurring";

export type ImportRow = {
  date: string;
  valueDate: string | null;
  amount: number;
  balance: number | null;
  concept: string | null;
  bankDetails: string | null;
};

type ContactInfo = { label: string; category: string | null; iva_rate: number; retencion_rate: number };

function buildAutoCategory(categories: { value: string; auto_keywords: string | null }[]) {
  return function (row: ImportRow): string | null {
    const hay = `${row.concept ?? ""} ${row.bankDetails ?? ""}`.toLowerCase();
    for (const cat of categories) {
      if (!cat.auto_keywords) continue;
      const kws = cat.auto_keywords.split(",").map((k: string) => k.trim().toLowerCase()).filter(Boolean);
      if (kws.some((kw: string) => hay.includes(kw))) return cat.value;
    }
    return null;
  };
}

/** "Movimiento" (concepto), "Más datos", fecha, fecha valor, importe y saldo vienen tal cual
 * del extracto del banco. "Contacto" lo nutrimos nosotros: solo se rellena si el patrón
 * concepto+más datos coincide con un contacto guardado (ver contact_concepts); si no hay
 * coincidencia queda en null, a la espera de asignarlo a mano. */
function buildRowInsert(
  patternMap: Map<string, ContactInfo>,
  autoCategory: (row: ImportRow) => string | null,
) {
  return function (row: ImportRow) {
    const contact = patternMap.get(contactKeyFor(row.concept, row.bankDetails));
    return {
      date: row.date,
      value_date: row.valueDate,
      amount: row.amount,
      balance: row.balance,
      concept: row.concept,
      bank_details: row.bankDetails,
      contact: contact?.label ?? null,
      category: contact?.category ?? autoCategory(row),
      iva_rate: contact ? contact.iva_rate : null,
      retencion_rate: contact ? contact.retencion_rate : null,
    };
  };
}

type ContactConceptJoinRow = { pattern: string; contacts: ContactInfo | ContactInfo[] | null };

async function loadContactPatternMap(
  supabase: ReturnType<typeof createServerClient>,
): Promise<Map<string, ContactInfo>> {
  const { data } = await supabase
    .from("contact_concepts")
    .select("pattern, contacts(label, category, iva_rate, retencion_rate)");
  const map = new Map<string, ContactInfo>();
  for (const row of (data ?? []) as ContactConceptJoinRow[]) {
    const c = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    if (c) map.set(row.pattern, c);
  }
  return map;
}

export async function getKnownContactPatterns(): Promise<string[]> {
  const supabase = createServerClient();
  const [{ data: concepts }, { data: ignored }] = await Promise.all([
    supabase.from("contact_concepts").select("pattern"),
    supabase.from("ignored_contact_patterns").select("pattern"),
  ]);
  return [
    ...(concepts ?? []).map((c: { pattern: string }) => c.pattern),
    ...(ignored ?? []).map((i: { pattern: string }) => i.pattern),
  ];
}

export async function getCategoriesForImport(): Promise<Category[]> {
  return loadCategories();
}

export type Contact = {
  id: number;
  label: string;
  category: string | null;
  ivaRate: number;
  retencionRate: number;
  patterns: string[];
};

type ContactRow = { id: number; label: string; category: string | null; iva_rate: number; retencion_rate: number; contact_concepts: { pattern: string }[] };

export async function getContacts(): Promise<Contact[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, label, category, iva_rate, retencion_rate, contact_concepts(pattern)")
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ContactRow[]).map((c) => ({
    id: c.id,
    label: c.label,
    category: c.category,
    ivaRate: c.iva_rate,
    retencionRate: c.retencion_rate,
    patterns: c.contact_concepts.map((cc) => cc.pattern),
  }));
}

export async function createContact(input: {
  label: string;
  category: string | null;
  ivaRate: number;
  retencionRate: number;
  patterns: string[];
}): Promise<Contact> {
  const supabase = createServerClient();
  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({ label: input.label, category: input.category, iva_rate: input.ivaRate, retencion_rate: input.retencionRate })
    .select("id, label, category, iva_rate, retencion_rate")
    .single();
  if (error) throw new Error(error.message);

  const patterns = [...new Set(input.patterns.map((p) => p.trim()).filter(Boolean))];
  if (patterns.length) {
    const { error: patError } = await supabase
      .from("contact_concepts")
      .upsert(patterns.map((pattern) => ({ contact_id: contact.id, pattern })), { onConflict: "pattern" });
    if (patError) throw new Error(patError.message);
  }
  return {
    id: contact.id, label: contact.label, category: contact.category,
    ivaRate: contact.iva_rate, retencionRate: contact.retencion_rate, patterns,
  };
}

export async function updateContact(
  id: number,
  patch: { label?: string; category?: string | null; ivaRate?: number; retencionRate?: number },
): Promise<void> {
  const supabase = createServerClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.ivaRate !== undefined) update.iva_rate = patch.ivaRate;
  if (patch.retencionRate !== undefined) update.retencion_rate = patch.retencionRate;
  const { error } = await supabase.from("contacts").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteContact(id: number): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Añade un patrón (concepto bancario) más que identifique a un contacto ya existente, p. ej.
 * cuando una empresa factura con un texto distinto al habitual. */
export async function addPatternToContact(contactId: number, pattern: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("contact_concepts")
    .upsert({ contact_id: contactId, pattern: pattern.trim() }, { onConflict: "pattern" });
  if (error) throw new Error(error.message);
}

export async function removeContactPattern(pattern: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("contact_concepts").delete().eq("pattern", pattern);
  if (error) throw new Error(error.message);
}

/** Recuerda un patrón descartado al revisar una importación, para no volver a sugerir crear
 * un contacto para él en futuras importaciones. */
export async function ignorePatterns(patterns: string[]): Promise<void> {
  const clean = [...new Set(patterns.map((p) => p.trim()).filter(Boolean))];
  if (!clean.length) return;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("ignored_contact_patterns")
    .upsert(clean.map((pattern) => ({ pattern })), { onConflict: "pattern" });
  if (error) throw new Error(error.message);
}

/** Copia categoría/IVA/retención a los movimientos ya importados (de cualquier fecha) que
 * coincidan con alguno de los patrones dados. Se usa tanto para "Aplicar a existentes" en
 * Configuración > Contactos como, automáticamente, al confirmar un contacto nuevo o añadir un
 * patrón a uno existente durante la importación — así no hace falta acordarse de aplicarlo
 * a mano para los movimientos que ya estaban importados antes de crear el contacto. */
async function applyPatternsToTransactions(
  supabase: ReturnType<typeof createServerClient>,
  patterns: Set<string>,
  contact: { category: string | null; iva_rate: number; retencion_rate: number },
): Promise<number> {
  if (patterns.size === 0) return 0;
  const { data: txns } = await supabase
    .from("transactions")
    .select("id, concept, bank_details")
    .is("deleted_at", null);

  const matchingIds = (txns ?? [])
    .filter((t: { id: string; concept: string | null; bank_details: string | null }) => patterns.has(contactKeyFor(t.concept, t.bank_details)))
    .map((t: { id: string }) => t.id);
  if (matchingIds.length === 0) return 0;

  const { error } = await supabase
    .from("transactions")
    .update({ category: contact.category, iva_rate: contact.iva_rate, retencion_rate: contact.retencion_rate })
    .in("id", matchingIds);
  if (error) throw new Error(error.message);
  return matchingIds.length;
}

/** Aplica retroactivamente los datos de un contacto a los movimientos ya importados que
 * coincidan con alguno de sus patrones, por si el contacto se creó o cambió después de
 * importarlos. */
export async function applyContactToExisting(contactId: number): Promise<{ updated: number }> {
  const supabase = createServerClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("category, iva_rate, retencion_rate, contact_concepts(pattern)")
    .eq("id", contactId)
    .single();
  if (!contact) return { updated: 0 };
  const patterns = new Set((contact.contact_concepts as { pattern: string }[]).map((c) => c.pattern));
  const updated = await applyPatternsToTransactions(supabase, patterns, contact);
  if (updated > 0) revalidateTag("transactions");
  return { updated };
}

/** Recalcula la columna "Contacto" de todos los movimientos a partir de "Más datos" +
 * concepto, cruzando con los contactos guardados. Solo hace falta ejecutarlo una vez tras
 * separar "Más datos" (texto crudo del banco) de "Contacto" (lo que nosotros asignamos) —
 * antes de eso, "contact" mezclaba ambos. Es idempotente: se puede volver a ejecutar sin
 * riesgo si se añaden contactos o patrones nuevos más adelante. */
export async function recomputeContactsFromBankDetails(): Promise<{ updated: number }> {
  const supabase = createServerClient();
  const [{ data: txns }, patternMap] = await Promise.all([
    supabase.from("transactions").select("id, concept, bank_details, contact").is("deleted_at", null),
    loadContactPatternMap(supabase),
  ]);

  const idsByNewContact = new Map<string, string[]>();
  for (const t of (txns ?? []) as { id: string; concept: string | null; bank_details: string | null; contact: string | null }[]) {
    const info = patternMap.get(contactKeyFor(t.concept, t.bank_details));
    const newContact = info?.label ?? null;
    if (newContact === t.contact) continue;
    const key = newContact ?? " ";
    if (!idsByNewContact.has(key)) idsByNewContact.set(key, []);
    idsByNewContact.get(key)!.push(t.id);
  }

  let updated = 0;
  for (const [key, ids] of idsByNewContact) {
    const { error } = await supabase
      .from("transactions")
      .update({ contact: key === " " ? null : key })
      .in("id", ids);
    if (error) throw new Error(error.message);
    updated += ids.length;
  }
  if (updated > 0) revalidateTag("transactions");
  return { updated };
}

export type NewContactDraft = {
  pattern: string;
  action: "create" | "attach" | "ignore";
  label: string;
  category: string | null;
  ivaRate: number;
  retencionRate: number;
  attachToContactId: number | null;
};

/** Guarda las decisiones tomadas al revisar los contactos nuevos detectados en una
 * importación: crear contacto, añadir el patrón a uno ya existente, o descartarlo (no volver
 * a preguntar). En los dos primeros casos aplica también categoría/IVA/retención a los
 * movimientos ya importados antes que coincidan con el patrón, sin esperar a que alguien
 * pulse "Aplicar a existentes" a mano en Configuración. */
export async function saveNewContacts(drafts: NewContactDraft[]): Promise<{ updated: number }> {
  if (!drafts.length) return { updated: 0 };
  const supabase = createServerClient();

  const toIgnore = drafts.filter((d) => d.action === "ignore").map((d) => d.pattern);
  if (toIgnore.length) await ignorePatterns(toIgnore);

  let updated = 0;
  for (const d of drafts) {
    if (d.action === "attach" && d.attachToContactId != null) {
      const { error } = await supabase
        .from("contact_concepts")
        .upsert({ contact_id: d.attachToContactId, pattern: d.pattern }, { onConflict: "pattern" });
      if (error) throw new Error(error.message);

      const { data: contact } = await supabase
        .from("contacts")
        .select("category, iva_rate, retencion_rate")
        .eq("id", d.attachToContactId)
        .single();
      if (contact) updated += await applyPatternsToTransactions(supabase, new Set([d.pattern]), contact);
    } else if (d.action === "create") {
      const { data: contact, error } = await supabase
        .from("contacts")
        .insert({ label: d.label, category: d.category, iva_rate: d.ivaRate, retencion_rate: d.retencionRate })
        .select("id, category, iva_rate, retencion_rate")
        .single();
      if (error) throw new Error(error.message);
      const { error: patError } = await supabase
        .from("contact_concepts")
        .insert({ contact_id: contact.id, pattern: d.pattern });
      if (patError) throw new Error(patError.message);

      updated += await applyPatternsToTransactions(supabase, new Set([d.pattern]), contact);
    }
  }
  if (updated > 0) revalidateTag("transactions");
  return { updated };
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
    loadContactPatternMap(supabase),
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
    loadContactPatternMap(supabase),
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

export async function updateTransactionBankDetails(id: string, bankDetails: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ bank_details: bankDetails.trim() || null })
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

/** Da de alta un gasto recurrente a partir de un único movimiento, sin esperar a que el
 * heurístico detecte 2+ pagos. Usa la misma "key" (contacto/concepto + importe) que
 * `findRecurringSeries`, así que si más adelante aparecen más pagos coincidentes se
 * enlazan con esta misma fila en vez de crear un pendiente duplicado. */
export async function createRecurringExpenseFromTransaction(
  transactionId: string,
  period: string,
  ivaRate: number,
  retencionRate: number,
): Promise<void> {
  const bucket = PERIOD_BUCKETS.find((b) => b.label === period);
  if (!bucket) throw new Error("Periodo inválido");

  const supabase = createServerClient();
  const { data: t, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .single();
  if (error || !t) throw new Error(error?.message ?? "Movimiento no encontrado");

  const key = seriesKeyFor(t as Transaction);
  if (!key) throw new Error("El movimiento no tiene contacto ni concepto para agruparlo");

  const { error: upsertError } = await supabase.from("recurring_expenses").upsert(
    {
      key,
      label: displayLabel(t as Transaction),
      category: t.category,
      period,
      period_days: bucket.days,
      amount: t.amount,
      iva_rate: ivaRate,
      retencion_rate: retencionRate,
      status: "confirmed",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (upsertError) throw new Error(upsertError.message);

  revalidateTag("recurring_expenses");
  revalidatePath("/gastos-recurrentes");
  revalidatePath("/analitica");
}
