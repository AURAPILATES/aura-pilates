"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

type CategoryInput = {
  value: string;
  label: string;
  emoji: string;
  bg_color: string;
  text_color: string;
  group_type: string;
  auto_keywords: string | null;
  sort_order: number;
};

function revalidateAll() {
  revalidatePath("/configuracion");
  revalidatePath("/transacciones");
  revalidatePath("/finanzas");
}

export async function createCategory(data: CategoryInput) {
  const supabase = createServerClient();
  const { error } = await supabase.from("categories").insert(data);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function updateCategory(id: string, data: CategoryInput) {
  const supabase = createServerClient();
  const { error } = await supabase.from("categories").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function deleteCategory(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}
