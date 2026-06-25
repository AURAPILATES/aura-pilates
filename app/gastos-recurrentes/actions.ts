"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath, revalidateTag } from "next/cache";

function revalidateAll() {
  revalidateTag("recurring_expenses");
  revalidatePath("/gastos-recurrentes");
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

export async function updateRecurringExpense(
  id: number,
  data: { amount?: number; iva_rate?: number; retencion_rate?: number; notes?: string | null; period?: string; period_days?: number },
) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("recurring_expenses")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
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
