import { createServerClient } from "@/lib/supabase";
import { unstable_cache } from "next/cache";

export type GroupType = "operational" | "income" | "transfer" | "internal";

export type Category = {
  id: string;
  value: string;
  label: string;
  emoji: string;
  bg_color: string;
  text_color: string;
  group_type: GroupType;
  auto_keywords: string | null;
  sort_order: number;
  created_at: string;
  parent_id: string | null;
  economic_group: string | null;
};

/** "Suministros > Agua" si `cat` es una subcategoría, o solo "Agua" si no tiene padre. */
export function categoryDisplayLabel(cat: Pick<Category, "label" | "parent_id">, all: Pick<Category, "id" | "label">[]): string {
  if (!cat.parent_id) return cat.label;
  const parent = all.find((c) => c.id === cat.parent_id);
  return parent ? `${parent.label} > ${cat.label}` : cat.label;
}

/** Categorías ordenadas para listas/selects: cada padre seguido inmediatamente de sus subcategorías. */
export function sortCategoriesHierarchical(categories: Category[]): Category[] {
  const byParent = new Map<string | null, Category[]>();
  for (const c of categories) {
    const key = c.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order);

  const result: Category[] = [];
  for (const parent of byParent.get(null) ?? []) {
    result.push(parent);
    result.push(...(byParent.get(parent.id) ?? []));
  }
  return result;
}

export async function loadCategories(): Promise<Category[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Category[];
}

export const loadCategoriesCached = unstable_cache(
  loadCategories,
  ["categories"],
  { revalidate: 3600, tags: ["categories"] },
);
