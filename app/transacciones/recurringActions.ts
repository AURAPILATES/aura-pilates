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
    key: string;
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
  const supabase = createServerClient();
  const { error } = await supabase.from("recurring_expenses").insert({ ...data, status });
  if (error) throw new Error(error.message);
  revalidateAll();
}

export type ConfirmRecurringRow = {
  key: string;
  label: string;
  category: string | null;
  period: string;
  period_days: number;
  amount: number;
  /** Texto de banco (concepto + más datos, ya limpios) del último movimiento de la serie —
   * se registra como patrón del contacto para que futuros movimientos se reconozcan solos. */
  bankPattern: string;
  contactId: number | null;
  newContactLabel: string | null;
};

/** Confirma uno o varios gastos detectados vinculándolos a un Contacto: el IVA/Retención se
 * hereda de su ficha (ver contacts en migrations/011_contacts.sql) en vez de teclearse a mano.
 * Si el contacto no existe todavía, lo crea. En ambos casos registra/asegura el patrón bancario
 * y aplica el contacto a los movimientos ya importados que coincidan (ver
 * resolveOrCreateContact y applyPatternsToTransactions en ./actions). */
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
      const { error: patError } = await supabase
        .from("contact_concepts")
        .upsert({ contact_id: contact.id, pattern: row.bankPattern }, { onConflict: "pattern" });
      if (patError) throw new Error(patError.message);
    } else if (row.newContactLabel) {
      contact = await resolveOrCreateContact(supabase, row.newContactLabel, row.bankPattern);
    } else {
      throw new Error("Selecciona o crea un contacto antes de confirmar");
    }

    const { error: upsertError } = await supabase.from("recurring_expenses").upsert(
      {
        key: row.key,
        label: row.label,
        category: contact.category ?? row.category,
        period: row.period,
        period_days: row.period_days,
        amount: row.amount,
        iva_rate: contact.iva_rate,
        retencion_rate: contact.retencion_rate,
        contact_id: contact.id,
        status: "confirmed",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (upsertError) throw new Error(upsertError.message);

    await applyPatternsToTransactions(supabase, new Set([row.bankPattern]), contact);
  }

  revalidateAll();
  revalidateTag("transactions");
}

export async function updateRecurringExpense(
  id: number,
  data: {
    amount?: number;
    contact_id?: number;
    notes?: string | null;
    period?: string;
    period_days?: number;
    end_type?: "never" | "date" | "count";
    end_date?: string | null;
    end_count?: number | null;
  },
) {
  const supabase = createServerClient();
  const update: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() };

  if (data.contact_id != null) {
    const { data: contact, error } = await supabase
      .from("contacts")
      .select("iva_rate, retencion_rate")
      .eq("id", data.contact_id)
      .single();
    if (error || !contact) throw new Error(error?.message ?? "Contacto no encontrado");
    update.iva_rate = contact.iva_rate;
    update.retencion_rate = contact.retencion_rate;
  }

  const { error } = await supabase.from("recurring_expenses").update(update).eq("id", id);
  if (error) throw new Error(error.message);
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
