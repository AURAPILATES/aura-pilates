"use server";
import { createServerClient } from "@/lib/supabase";
import { revalidatePath, revalidateTag } from "next/cache";

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
};

function revalidateAll() {
  revalidateTag("categories");
  revalidatePath("/configuracion");
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
