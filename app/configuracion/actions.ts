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

// La jerarquía de categorías admite hasta 3 niveles (índices 0, 1, 2).
const MAX_CATEGORY_DEPTH = 2;

/** Helpers de árbol sobre la lista de categorías (profundidad, altura de subárbol y
 * descendientes) para validar en servidor que anidar no supere 3 niveles ni cree ciclos. */
function hierarchyHelpers(all: { id: string; parent_id: string | null }[]) {
  const byId = new Map(all.map((r) => [r.id, r]));
  const childrenOf = new Map<string, string[]>();
  for (const r of all) {
    if (!r.parent_id) continue;
    const arr = childrenOf.get(r.parent_id) ?? [];
    arr.push(r.id);
    childrenOf.set(r.parent_id, arr);
  }
  const depthOf = (nodeId: string): number => {
    let d = 0;
    let cur = byId.get(nodeId);
    const seen = new Set<string>();
    while (cur?.parent_id && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parent_id);
      if (cur) d++;
    }
    return d;
  };
  const heightOf = (nodeId: string): number => {
    const kids = childrenOf.get(nodeId) ?? [];
    return kids.length === 0 ? 0 : 1 + Math.max(...kids.map(heightOf));
  };
  const descendantsOf = (nodeId: string): Set<string> => {
    const set = new Set<string>();
    const stack = [nodeId];
    while (stack.length) {
      const n = stack.pop()!;
      for (const c of childrenOf.get(n) ?? []) {
        if (!set.has(c)) { set.add(c); stack.push(c); }
      }
    }
    return set;
  };
  return { depthOf, heightOf, descendantsOf };
}

async function loadHierarchy(supabase: ReturnType<typeof createServerClient>) {
  const { data, error } = await supabase.from("categories").select("id, parent_id");
  if (error) throw new Error(error.message);
  return hierarchyHelpers((data ?? []) as { id: string; parent_id: string | null }[]);
}

export async function createCategory(data: CategoryInput) {
  const supabase = createServerClient();
  if (data.parent_id) {
    const { depthOf } = await loadHierarchy(supabase);
    if (depthOf(data.parent_id) + 1 > MAX_CATEGORY_DEPTH) {
      throw new Error("Se superarían los tres niveles de categorías permitidos.");
    }
  }
  const { error } = await supabase.from("categories").insert(data);
  if (error) throw new Error(error.message);
  await applyCategoryKeywordsToTransactions(data.value, data.auto_keywords);
  revalidateAll();
}

export async function updateCategory(id: string, data: CategoryInput) {
  const supabase = createServerClient();
  if (data.parent_id) {
    // Máximo 3 niveles: la nueva rama (padre + esta categoría + sus descendientes) no puede
    // superar la profundidad permitida, y una categoría no puede colgar de sí misma ni de
    // una de sus subcategorías (ciclo).
    const { depthOf, heightOf, descendantsOf } = await loadHierarchy(supabase);
    if (data.parent_id === id || descendantsOf(id).has(data.parent_id)) {
      throw new Error("Una categoría no puede depender de sí misma ni de una de sus subcategorías.");
    }
    if (depthOf(data.parent_id) + 1 + heightOf(id) > MAX_CATEGORY_DEPTH) {
      throw new Error("Se superarían los tres niveles de categorías permitidos.");
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
