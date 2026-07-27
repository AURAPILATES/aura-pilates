"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath, revalidateTag } from "next/cache";
import type { PaymentMethod, Transaction } from "@/lib/transactions";
import { loadCategories, type Category } from "@/lib/categories";
import { contactKeyFor, recleanPattern, matchesPattern } from "@/lib/contactRules";
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
  patterns: PatternEntry[],
  autoCategory: (row: ImportRow) => string | null,
) {
  return function (row: ImportRow) {
    const contact = matchContact(contactKeyFor(row.concept, row.bankDetails), patterns);
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
type PatternEntry = { pattern: string; contact: ContactInfo };

async function loadContactPatternMap(
  supabase: ReturnType<typeof createServerClient>,
): Promise<PatternEntry[]> {
  const { data } = await supabase
    .from("contact_concepts")
    .select("pattern, contacts(label, category, iva_rate, retencion_rate)");
  const entries: PatternEntry[] = [];
  for (const row of (data ?? []) as ContactConceptJoinRow[]) {
    const c = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    if (c) entries.push({ pattern: row.pattern, contact: c });
  }
  return entries;
}

/** Busca el contacto cuyo patrón guardado aparece dentro del texto de un movimiento (ver
 * matchesPattern) - así un "Concepto bancario" editado a mano para quedarse más corto que el
 * texto real del banco (ej. "Stripe" en vez de "Stripe Technology Eu") sigue reconociendo el
 * contacto en futuros movimientos. */
function matchContact(text: string, patterns: PatternEntry[]): ContactInfo | undefined {
  return patterns.find((p) => matchesPattern(text, p.pattern))?.contact;
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
  noTax: boolean;
  /** proveedor | instructor | socio, o null = se deduce del nombre (ver contactGroupOf). */
  group: string | null;
  patterns: string[];
};

type ContactRow = { id: number; label: string; category: string | null; iva_rate: number; retencion_rate: number; no_tax: boolean; contact_group: string | null; contact_concepts: { pattern: string }[] };

export async function getContacts(): Promise<Contact[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, label, category, iva_rate, retencion_rate, no_tax, contact_group, contact_concepts(pattern)")
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ContactRow[]).map((c) => ({
    id: c.id,
    label: c.label,
    category: c.category,
    ivaRate: c.iva_rate,
    retencionRate: c.retencion_rate,
    noTax: c.no_tax,
    group: c.contact_group,
    patterns: c.contact_concepts.map((cc) => cc.pattern),
  }));
}

export type ContactStats = { count: number; total: number; latest: { id: string; date: string; amount: number; concept: string | null }[] };

/** Recuento, suma y últimos movimientos por contacto, cruzando sus patrones con los
 * movimientos importados - para mostrar en la tabla/drawer de Configuración > Contactos sin
 * hacer una consulta por contacto. */
export async function getContactsStats(): Promise<Record<number, ContactStats>> {
  const supabase = createServerClient();
  const [{ data: contactRows }, { data: txns }] = await Promise.all([
    supabase.from("contacts").select("id, contact_concepts(pattern)"),
    supabase.from("transactions").select("id, date, amount, concept, bank_details").is("deleted_at", null).order("date", { ascending: false }),
  ]);

  const contactPatterns = (contactRows ?? []) as { id: number; contact_concepts: { pattern: string }[] }[];

  const stats: Record<number, ContactStats> = {};
  for (const t of (txns ?? []) as { id: string; date: string; amount: number; concept: string | null; bank_details: string | null }[]) {
    const key = contactKeyFor(t.concept, t.bank_details);
    const match = contactPatterns.find((c) => c.contact_concepts.some((cc) => matchesPattern(key, cc.pattern)));
    if (!match) continue;
    const s = stats[match.id] ?? (stats[match.id] = { count: 0, total: 0, latest: [] });
    s.count++;
    s.total += t.amount;
    if (s.latest.length < 5) s.latest.push({ id: t.id, date: t.date, amount: t.amount, concept: t.concept });
  }
  return stats;
}

export async function createContact(input: {
  label: string;
  category: string | null;
  ivaRate: number;
  retencionRate: number;
  noTax?: boolean;
  group?: string | null;
  patterns: string[];
}): Promise<Contact> {
  const supabase = createServerClient();
  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({ label: input.label, category: input.category, iva_rate: input.ivaRate, retencion_rate: input.retencionRate, no_tax: input.noTax ?? false, contact_group: input.group ?? null })
    .select("id, label, category, iva_rate, retencion_rate, no_tax, contact_group")
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
    ivaRate: contact.iva_rate, retencionRate: contact.retencion_rate, noTax: contact.no_tax, group: contact.contact_group, patterns,
  };
}

export async function updateContact(
  id: number,
  patch: { label?: string; category?: string | null; ivaRate?: number; retencionRate?: number; noTax?: boolean; group?: string | null },
): Promise<void> {
  const supabase = createServerClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.ivaRate !== undefined) update.iva_rate = patch.ivaRate;
  if (patch.retencionRate !== undefined) update.retencion_rate = patch.retencionRate;
  if (patch.noTax !== undefined) update.no_tax = patch.noTax;
  if (patch.group !== undefined) update.contact_group = patch.group;
  const { error } = await supabase.from("contacts").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  if (patch.category !== undefined || patch.ivaRate !== undefined || patch.retencionRate !== undefined) {
    await applyContactToExisting(id);
  }
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
 * patrón a uno existente durante la importación - así no hace falta acordarse de aplicarlo
 * a mano para los movimientos que ya estaban importados antes de crear el contacto. */
export async function applyPatternsToTransactions(
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
    .filter((t: { id: string; concept: string | null; bank_details: string | null }) => {
      const key = contactKeyFor(t.concept, t.bank_details);
      return [...patterns].some((p) => matchesPattern(key, p));
    })
    .map((t: { id: string }) => t.id);
  if (matchingIds.length === 0) return 0;

  const { error } = await supabase
    .from("transactions")
    .update({ category: contact.category, iva_rate: contact.iva_rate, retencion_rate: contact.retencion_rate })
    .in("id", matchingIds);
  if (error) throw new Error(error.message);
  return matchingIds.length;
}

/** Reaplica los "conceptos bancarios" (auto_keywords) de una categoría a los movimientos ya
 * importados que todavía no tienen categoría: cualquiera cuyo concepto/"más datos" contenga
 * alguno de esos textos pasa a tener esa categoría. Se usa al crear o editar una categoría desde
 * Configuración, para que añadir un concepto nuevo no se quede solo aplicando a futuras
 * importaciones. Solo toca movimientos sin categoría todavía: si ya tienen una (puesta a mano o
 * por un contacto, ver applyContactToExisting) no se sobrescribe. */
export async function applyCategoryKeywordsToTransactions(
  categoryValue: string,
  autoKeywords: string | null,
): Promise<{ updated: number }> {
  const keywords = (autoKeywords ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (!keywords.length) return { updated: 0 };

  const supabase = createServerClient();
  const { data: txns } = await supabase
    .from("transactions")
    .select("id, concept, bank_details")
    .is("deleted_at", null)
    .is("category", null);

  const matchingIds = (txns ?? [])
    .filter((t: { id: string; concept: string | null; bank_details: string | null }) => {
      const hay = `${t.concept ?? ""} ${t.bank_details ?? ""}`.toLowerCase();
      return keywords.some((kw) => hay.includes(kw));
    })
    .map((t: { id: string }) => t.id);
  if (!matchingIds.length) return { updated: 0 };

  const { error } = await supabase
    .from("transactions")
    .update({ category: categoryValue })
    .in("id", matchingIds);
  if (error) throw new Error(error.message);
  revalidateTag("transactions");
  return { updated: matchingIds.length };
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
 * separar "Más datos" (texto crudo del banco) de "Contacto" (lo que nosotros asignamos) -
 * antes de eso, "contact" mezclaba ambos. Es idempotente: se puede volver a ejecutar sin
 * riesgo si se añaden contactos o patrones nuevos más adelante. */
export async function recomputeContactsFromBankDetails(dryRun = false): Promise<{ updated: number }> {
  const supabase = createServerClient();
  const [{ data: txns }, patternMap] = await Promise.all([
    supabase.from("transactions").select("id, concept, bank_details, contact").is("deleted_at", null),
    loadContactPatternMap(supabase),
  ]);

  const idsByNewContact = new Map<string, string[]>();
  for (const t of (txns ?? []) as { id: string; concept: string | null; bank_details: string | null; contact: string | null }[]) {
    const info = matchContact(contactKeyFor(t.concept, t.bank_details), patternMap);
    const newContact = info?.label ?? null;
    if (newContact === t.contact) continue;
    const key = newContact ?? " ";
    if (!idsByNewContact.has(key)) idsByNewContact.set(key, []);
    idsByNewContact.get(key)!.push(t.id);
  }

  if (dryRun) {
    const total = [...idsByNewContact.values()].reduce((s, ids) => s + ids.length, 0);
    return { updated: total };
  }

  let updated = 0;
  for (const [key, ids] of idsByNewContact) {
    const { error } = await supabase
      .from("transactions")
      .update({ contact: key === " " ? null : key })
      .in("id", ids);
    if (error) throw new Error(error.message);
    updated += ids.length;
  }
  if (updated > 0) revalidateTag("transactions");
  return { updated };
}

/** Re-limpia los patrones ya guardados (contact_concepts e ignored_contact_patterns) con las
 * reglas actuales de cleanBankText, por si se crearon antes de afinarlas y arrastran un
 * código variable (ej. una referencia de operación) que les impide volver a coincidir.
 * Si dos patrones distintos limpian al mismo resultado, se fusionan en uno. */
export async function cleanupContactPatterns(dryRun = false): Promise<{ updated: number; merged: number }> {
  const supabase = createServerClient();
  let updated = 0;
  let merged = 0;

  const { data: concepts } = await supabase.from("contact_concepts").select("id, contact_id, pattern");
  const seen = new Map<string, number>(); // "contactId:newPattern" -> concept id ya migrado
  for (const row of (concepts ?? []) as { id: number; contact_id: number; pattern: string }[]) {
    const next = recleanPattern(row.pattern);
    if (next === row.pattern) { seen.set(`${row.contact_id}:${next}`, row.id); continue; }

    const dupKey = `${row.contact_id}:${next}`;
    const { data: clash } = await supabase.from("contact_concepts").select("id").eq("pattern", next).maybeSingle();
    if (seen.has(dupKey) || clash) {
      if (!dryRun) await supabase.from("contact_concepts").delete().eq("id", row.id);
      merged++;
      continue;
    }
    if (dryRun) { updated++; seen.set(dupKey, row.id); continue; }
    const { error } = await supabase.from("contact_concepts").update({ pattern: next }).eq("id", row.id);
    if (!error) { updated++; seen.set(dupKey, row.id); }
  }

  const { data: ignored } = await supabase.from("ignored_contact_patterns").select("pattern");
  for (const row of (ignored ?? []) as { pattern: string }[]) {
    const next = recleanPattern(row.pattern);
    if (next === row.pattern) continue;
    const { data: clash } = await supabase.from("ignored_contact_patterns").select("pattern").eq("pattern", next).maybeSingle();
    if (!dryRun) await supabase.from("ignored_contact_patterns").delete().eq("pattern", row.pattern);
    if (!clash) {
      if (dryRun) { updated++; continue; }
      const { error } = await supabase.from("ignored_contact_patterns").insert({ pattern: next });
      if (!error) updated++;
    } else {
      merged++;
    }
  }

  return { updated, merged };
}

export type ResolvedContact = { id: number; category: string | null; iva_rate: number; retencion_rate: number };

/** Busca un contacto por nombre (sin distinguir mayúsculas); si no existe lo crea, y registra
 * `pattern` (concepto + más datos, ya limpios) como uno de sus conceptos de reconocimiento -
 * así la próxima vez que aparezca ese texto bancario se asigna solo. Usado tanto al asignar un
 * contacto a mano desde el detalle de un movimiento como al confirmar un gasto recurrente. */
export async function resolveOrCreateContact(
  supabase: ReturnType<typeof createServerClient>,
  label: string,
  pattern: string | string[],
): Promise<ResolvedContact> {
  const { data: existing } = await supabase
    .from("contacts")
    .select("id, category, iva_rate, retencion_rate")
    .ilike("label", label)
    .maybeSingle();

  let contact: ResolvedContact | null = existing;
  if (!contact) {
    const { data: created, error: createError } = await supabase
      .from("contacts")
      .insert({ label })
      .select("id, category, iva_rate, retencion_rate")
      .single();
    if (createError) throw new Error(createError.message);
    contact = created;
  }

  const patterns = [...new Set(Array.isArray(pattern) ? pattern : [pattern])].filter(Boolean);
  if (patterns.length) {
    const { error: patError } = await supabase
      .from("contact_concepts")
      .upsert(patterns.map((p) => ({ contact_id: contact.id, pattern: p })), { onConflict: "pattern" });
    if (patError) throw new Error(patError.message);
  }

  return contact;
}

/** Asigna un contacto a un movimiento concreto: si el contacto no existe todavía lo crea, y
 * registra el patrón (concepto + más datos, ya limpios) de este movimiento para que la
 * próxima vez que aparezca se reconozca solo - la misma idea que confirmar un contacto nuevo
 * al importar, pero hecha a mano desde el detalle de un movimiento ya importado. */
export async function assignContactToTransaction(transactionId: string, contactLabel: string): Promise<void> {
  const supabase = createServerClient();
  const label = contactLabel.trim();

  if (!label) {
    const { error } = await supabase.from("transactions").update({ contact: null }).eq("id", transactionId);
    if (error) throw new Error(error.message);
    revalidateTag("transactions");
    return;
  }

  const { data: t, error: loadError } = await supabase
    .from("transactions")
    .select("concept, bank_details")
    .eq("id", transactionId)
    .single();
  if (loadError || !t) throw new Error(loadError?.message ?? "Movimiento no encontrado");

  const pattern = contactKeyFor(t.concept, t.bank_details);
  const contact = await resolveOrCreateContact(supabase, label, pattern);

  const { error: updError } = await supabase
    .from("transactions")
    .update({ contact: label, category: contact.category, iva_rate: contact.iva_rate, retencion_rate: contact.retencion_rate })
    .eq("id", transactionId);
  if (updError) throw new Error(updError.message);

  await applyPatternsToTransactions(supabase, new Set([pattern]), contact);
  revalidateTag("transactions");
}

export type NewContactDraft = {
  pattern: string;
  bankPatterns: string[];
  action: "create" | "attach" | "ignore";
  label: string;
  category: string | null;
  ivaRate: number;
  retencionRate: number;
  group?: string | null;
  attachToContactId: number | null;
};

/** Guarda las decisiones tomadas al revisar los contactos nuevos detectados en una
 * importación: crear contacto, añadir el patrón a uno ya existente, o descartarlo (no volver
 * a preguntar). "Concepto bancario" (bankPatterns) son los textos, editados a mano por el
 * usuario si hace falta, que se guardan como patrones de reconocimiento - pueden ser más cortos
 * que el texto crudo del banco (ver matchesPattern en lib/contactRules). En los dos primeros
 * casos aplica también categoría/IVA/retención a los movimientos ya importados antes que
 * coincidan, sin esperar a que alguien pulse "Aplicar a existentes" a mano en Configuración. */
export async function saveNewContacts(drafts: NewContactDraft[]): Promise<{ updated: number }> {
  if (!drafts.length) return { updated: 0 };
  const supabase = createServerClient();

  const toIgnore = drafts.filter((d) => d.action === "ignore").map((d) => d.pattern);
  if (toIgnore.length) await ignorePatterns(toIgnore);

  let updated = 0;
  for (const d of drafts) {
    const rawPatterns = d.bankPatterns.length ? d.bankPatterns : [d.pattern];
    const patterns = [...new Set(rawPatterns.map((p) => recleanPattern(p.trim() || d.pattern)))];
    if (d.action === "attach" && d.attachToContactId != null) {
      const { error } = await supabase
        .from("contact_concepts")
        .upsert(patterns.map((pattern) => ({ contact_id: d.attachToContactId, pattern })), { onConflict: "pattern" });
      if (error) throw new Error(error.message);

      const { data: contact } = await supabase
        .from("contacts")
        .select("category, iva_rate, retencion_rate")
        .eq("id", d.attachToContactId)
        .single();
      if (contact) updated += await applyPatternsToTransactions(supabase, new Set(patterns), contact);
    } else if (d.action === "create") {
      const { data: contact, error } = await supabase
        .from("contacts")
        .insert({ label: d.label, category: d.category, iva_rate: d.ivaRate, retencion_rate: d.retencionRate, contact_group: d.group ?? "proveedor" })
        .select("id, category, iva_rate, retencion_rate")
        .single();
      if (error) throw new Error(error.message);
      const { error: patError } = await supabase
        .from("contact_concepts")
        .insert(patterns.map((pattern) => ({ contact_id: contact.id, pattern })));
      if (patError) throw new Error(patError.message);

      updated += await applyPatternsToTransactions(supabase, new Set(patterns), contact);
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
  contact?: string | null;
  notes?: string;
  paymentMethod?: PaymentMethod;
}): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("transactions").insert({
    date: input.date,
    amount: input.amount,
    balance: null,
    concept: input.concept.trim() || null,
    contact: input.contact?.trim() || null,
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

/** Cambia el importe de un movimiento (p.ej. para alternar entre ingreso y gasto en efectivo,
 * negando el signo). */
export async function updateTransactionAmount(id: string, amount: number) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("transactions")
    .update({ amount })
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
  contactId: number | null,
  end?: { type: "never" | "date" | "count"; date?: string | null; count?: number | null },
): Promise<void> {
  const bucket = PERIOD_BUCKETS.find((b) => b.label === period);
  if (!bucket) throw new Error("Periodo inválido");

  const supabase = createServerClient();
  const [{ data: t, error }, { data: allTxns }] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", transactionId).single(),
    supabase.from("transactions").select("*").is("deleted_at", null),
  ]);
  if (error || !t) throw new Error(error?.message ?? "Movimiento no encontrado");

  const key = seriesKeyFor(t as Transaction, (allTxns ?? []) as Transaction[]);
  if (!key) throw new Error("El movimiento no tiene contacto ni concepto para agruparlo");

  let ivaRate = 0;
  let retencionRate = 0;
  let category = t.category;
  if (contactId != null) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("category, iva_rate, retencion_rate")
      .eq("id", contactId)
      .single();
    if (contactError || !contact) throw new Error(contactError?.message ?? "Contacto no encontrado");
    ivaRate = contact.iva_rate;
    retencionRate = contact.retencion_rate;
    category = contact.category ?? t.category;
  }

  const { error: upsertError } = await supabase.from("recurring_expenses").upsert(
    {
      key,
      label: displayLabel(t as Transaction),
      category,
      period,
      period_days: bucket.days,
      amount: t.amount,
      iva_rate: ivaRate,
      retencion_rate: retencionRate,
      contact_id: contactId,
      status: "confirmed",
      end_type: end?.type ?? "never",
      end_date: end?.type === "date" ? end.date ?? null : null,
      end_count: end?.type === "count" ? end.count ?? null : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (upsertError) throw new Error(upsertError.message);

  revalidateTag("recurring_expenses");
  revalidatePath("/transacciones");
  revalidatePath("/analitica");
}

/** Desmarca un movimiento como recurrente: borra la fila de `recurring_expenses` dada de
 * alta manualmente desde este movimiento (misma key que `createRecurringExpenseFromTransaction`). */
export async function removeRecurringExpenseForTransaction(transactionId: string): Promise<void> {
  const supabase = createServerClient();
  const [{ data: t, error }, { data: allTxns }] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", transactionId).single(),
    supabase.from("transactions").select("*").is("deleted_at", null),
  ]);
  if (error || !t) throw new Error(error?.message ?? "Movimiento no encontrado");

  const key = seriesKeyFor(t as Transaction, (allTxns ?? []) as Transaction[]);
  if (!key) return;

  const { error: deleteError } = await supabase.from("recurring_expenses").delete().eq("key", key);
  if (deleteError) throw new Error(deleteError.message);

  revalidateTag("recurring_expenses");
  revalidatePath("/transacciones");
  revalidatePath("/analitica");
}
