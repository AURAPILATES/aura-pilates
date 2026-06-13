"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

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
