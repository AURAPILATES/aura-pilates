"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath, revalidateTag } from "next/cache";
import { applyCategoryKeywordsToTransactions } from "@/app/transacciones/actions";

type CategoryInput = {
  value: string;
  label: string;
  emoji: string;
  bg_color: string;
  text_color: string;
  group_type: string;
  auto_keywords: string | null;
  sort_order: number;
  parent_id: string | null;
  economic_group: string | null;
};

function revalidateAll() {
  revalidateTag("categories");
  revalidatePath("/configuracion");
}

export async function createCategory(data: CategoryInput) {
  const supabase = createServerClient();
  const { error } = await supabase.from("categories").insert(data);
  if (error) throw new Error(error.message);
  await applyCategoryKeywordsToTransactions(data.value, data.auto_keywords);
  revalidateAll();
}

export async function updateCategory(id: string, data: CategoryInput) {
  const supabase = createServerClient();
  if (data.parent_id) {
    // La pantalla solo soporta dos niveles (padre → hijas); si esta categoría
    // ya tiene hijas propias, convertirla en hija de otra la dejaría a 3
    // niveles y las nietas dejarían de mostrarse en el árbol.
    const { count, error: countError } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", id);
    if (countError) throw new Error(countError.message);
    if (count && count > 0) {
      throw new Error("Esta categoría tiene subcategorías propias y no puede moverse bajo otra categoría.");
    }
  }
  const { error } = await supabase.from("categories").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  await applyCategoryKeywordsToTransactions(data.value, data.auto_keywords);
  revalidateAll();
}

export async function deleteCategory(id: string) {
  const supabase = createServerClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function reorderCategories(updates: { id: string; sort_order: number }[]) {
  if (!updates.length) return;
  const supabase = createServerClient();
  const results = await Promise.all(
    updates.map((u) => supabase.from("categories").update({ sort_order: u.sort_order }).eq("id", u.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidateAll();
}

export async function updateCategoryColors(updates: { id: string; bg_color: string; text_color: string }[]) {
  if (!updates.length) return;
  const supabase = createServerClient();
  const results = await Promise.all(
    updates.map((u) => supabase.from("categories").update({ bg_color: u.bg_color, text_color: u.text_color }).eq("id", u.id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidateAll();
}
