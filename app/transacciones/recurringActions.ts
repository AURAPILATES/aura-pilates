"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath, revalidateTag } from "next/cache";
import { resolveOrCreateContact, applyPatternsToTransactions, type ResolvedContact } from "./actions";

function revalidateAll() {
  revalidateTag("recurring_expenses");
  revalidatePath("/transacciones");
  revalidatePath("/analitica");
}

export async function recordRecurringExpense(
  data: {
    keys: string[];
    label: string;
    category: string | null;
    period: string;
    period_days: number;
    amount: number;
    iva_rate: number;
    retencion_rate: number;
  },
  status: "confirmed" | "ignored" = "confirmed",
) {
  if (!data.keys.length) return;
  const supabase = createServerClient();
  const { keys, ...rest } = data;
  const { error } = await supabase
    .from("recurring_expenses")
    .insert(keys.map((key) => ({ ...rest, key, status })));
  if (error) throw new Error(error.message);
  revalidateAll();
}

export type ConfirmRecurringRow = {
  /** Una fila puede agrupar varias series detectadas (mismo contacto + mismo importe pero
   * separadas porque parte de los movimientos todavía no tenían el contacto asignado en el
   * texto bancario) - se confirma una fila de recurring_expenses por cada key para que ninguna
   * de las variantes vuelva a aparecer como pendiente. */
  keys: string[];
  label: string;
  category: string | null;
  period: string;
  period_days: number;
  amount: number;
  /** Textos de banco (concepto + más datos, ya limpios) de cada serie agrupada - se registran
   * todos como patrones del contacto para que futuros movimientos de cualquier variante se
   * reconozcan solos. */
  bankPatterns: string[];
  contactId: number | null;
  newContactLabel: string | null;
  /** IVA/retención tal y como quedan tras validarlos en el drawer de confirmación - parten del
   * contacto por defecto pero el usuario puede corregirlos para esta recurrencia concreta. */
  ivaRate: number;
  retencionRate: number;
  endType: "never" | "date" | "count";
  endDate: string | null;
  endCount: number | null;
};

/** Confirma uno o varios gastos detectados vinculándolos a un Contacto: el IVA/Retención parten
 * de su ficha (ver contacts en migrations/011_contacts.sql) pero se guardan tal y como llegan en
 * `row` - el usuario los valida/corrige fila a fila en el drawer antes de confirmar. Si el
 * contacto no existe todavía, lo crea. En ambos casos registra/asegura los patrones bancarios y
 * aplica el contacto a los movimientos ya importados que coincidan (ver resolveOrCreateContact y
 * applyPatternsToTransactions en ./actions). */
export async function confirmRecurringExpenses(rows: ConfirmRecurringRow[]): Promise<void> {
  if (!rows.length) return;
  const supabase = createServerClient();

  for (const row of rows) {
    let contact: ResolvedContact;
    if (row.contactId != null) {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, category, iva_rate, retencion_rate")
        .eq("id", row.contactId)
        .single();
      if (error || !data) throw new Error(error?.message ?? "Contacto no encontrado");
      contact = data;
      if (row.bankPatterns.length) {
        const { error: patError } = await supabase
          .from("contact_concepts")
          .upsert(row.bankPatterns.map((pattern) => ({ contact_id: contact.id, pattern })), { onConflict: "pattern" });
        if (patError) throw new Error(patError.message);
      }
    } else if (row.newContactLabel) {
      contact = await resolveOrCreateContact(supabase, row.newContactLabel, row.bankPatterns);
    } else {
      throw new Error("Selecciona o crea un contacto antes de confirmar");
    }

    for (const key of row.keys) {
      const { error: upsertError } = await supabase.from("recurring_expenses").upsert(
        {
          key,
          label: row.label,
          category: contact.category ?? row.category,
          period: row.period,
          period_days: row.period_days,
          amount: row.amount,
          iva_rate: row.ivaRate,
          retencion_rate: row.retencionRate,
          contact_id: contact.id,
          status: "confirmed",
          end_type: row.endType,
          end_date: row.endType === "date" ? row.endDate : null,
          end_count: row.endType === "count" ? row.endCount : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
      if (upsertError) throw new Error(upsertError.message);
    }

    await applyPatternsToTransactions(supabase, new Set(row.bankPatterns), contact);
  }

  revalidateAll();
  revalidateTag("transactions");
}

export type ManualRecurringInput = {
  label: string;
  category: string | null;
  period: string;
  period_days: number;
  amount: number; // negativo
  anchorDate: string;
  contactId: number | null;
  newContactLabel: string | null;
  endType: "never" | "date" | "count";
  endDate: string | null;
  endCount: number | null;
};

/** Da de alta un gasto recurrente "por libre": sin transacción real detrás (a diferencia de
 * `confirmRecurringExpenses`/`recordRecurringExpense`, que siempre parten de una serie ya
 * detectada). Pensado para anticipar un gasto futuro conocido (ej. "en 2 meses empiezo a pagar
 * X"). La key es sintética (no enlaza con ninguna transacción) y `anchor_date` guarda desde
 * cuándo proyectar el próximo pago (ver forecastConfirmedExpenses). */
export async function createManualRecurringExpense(input: ManualRecurringInput): Promise<void> {
  const supabase = createServerClient();

  let contact: ResolvedContact | null = null;
  if (input.contactId != null) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, category, iva_rate, retencion_rate")
      .eq("id", input.contactId)
      .single();
    if (error || !data) throw new Error(error?.message ?? "Contacto no encontrado");
    contact = data;
  } else if (input.newContactLabel) {
    contact = await resolveOrCreateContact(supabase, input.newContactLabel, []);
  }

  const { error } = await supabase.from("recurring_expenses").insert({
    key: `m:${crypto.randomUUID()}`,
    label: input.label,
    category: contact?.category ?? input.category,
    period: input.period,
    period_days: input.period_days,
    amount: input.amount,
    iva_rate: contact?.iva_rate ?? 0,
    retencion_rate: contact?.retencion_rate ?? 0,
    contact_id: contact?.id ?? null,
    status: "confirmed",
    manual: true,
    anchor_date: input.anchorDate,
    end_type: input.endType,
    end_date: input.endType === "date" ? input.endDate : null,
    end_count: input.endType === "count" ? input.endCount : null,
  });
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function updateRecurringExpense(
  id: number,
  data: {
    label?: string;
    amount?: number;
    notes?: string | null;
    period?: string;
    period_days?: number;
    iva_rate?: number;
    retencion_rate?: number;
    anchor_date?: string | null;
    end_type?: "never" | "date" | "count";
    end_date?: string | null;
    end_count?: number | null;
  },
) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("recurring_expenses")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

/** Re-vincula un gasto recurrente ya confirmado a otro Contacto (existente o nuevo) - vuelve a
 * copiar su IVA/Retención, igual que en la confirmación inicial. A diferencia de
 * `confirmRecurringExpenses`, aquí no se registra ningún patrón bancario nuevo: el movimiento
 * ya estaba reconocido antes, esto solo cambia de qué ficha hereda los impuestos. */
export async function relinkRecurringExpenseContact(
  id: number,
  pick: { contactId: number } | { newContactLabel: string },
): Promise<void> {
  const supabase = createServerClient();
  let contact: ResolvedContact;
  if ("contactId" in pick) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, category, iva_rate, retencion_rate")
      .eq("id", pick.contactId)
      .single();
    if (error || !data) throw new Error(error?.message ?? "Contacto no encontrado");
    contact = data;
  } else {
    const { data, error } = await supabase
      .from("contacts")
      .insert({ label: pick.newContactLabel })
      .select("id, category, iva_rate, retencion_rate")
      .single();
    if (error) throw new Error(error.message);
    contact = data;
  }

  const { error: updateError } = await supabase
    .from("recurring_expenses")
    .update({
      contact_id: contact.id,
      iva_rate: contact.iva_rate,
      retencion_rate: contact.retencion_rate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);
  revalidateAll();
}

export async function setRecurringExpenseStatus(id: number, status: "confirmed" | "ignored" | "cancelled") {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("recurring_expenses")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function deleteRecurringExpense(id: number) {
  const supabase = createServerClient();
  const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function deleteRecurringExpenses(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const supabase = createServerClient();
  const { error } = await supabase.from("recurring_expenses").delete().in("id", ids);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function updateRecurringExpensesCategory(ids: number[], category: string | null): Promise<void> {
  if (!ids.length) return;
  const supabase = createServerClient();
  const { error } = await supabase
    .from("recurring_expenses")
    .update({ category, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw new Error(error.message);
  revalidateAll();
}

/** Igual que `relinkRecurringExpenseContact` pero para varias filas a la vez - se usa desde la
 * selección múltiple de Recurrentes. Solo admite un contacto ya existente (no crea uno nuevo,
 * a diferencia de la versión de una sola fila). */
export async function relinkRecurringExpensesContact(ids: number[], contactId: number): Promise<void> {
  if (!ids.length) return;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, category, iva_rate, retencion_rate")
    .eq("id", contactId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Contacto no encontrado");

  const { error: updateError } = await supabase
    .from("recurring_expenses")
    .update({
      contact_id: data.id,
      iva_rate: data.iva_rate,
      retencion_rate: data.retencion_rate,
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
  if (updateError) throw new Error(updateError.message);
  revalidateAll();
}
