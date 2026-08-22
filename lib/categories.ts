import { createServerClient } from "@/lib/supabase";
import { unstable_cache } from "next/cache";

export type GroupType = "operational" | "income" | "transfer" | "internal";

/** Traspasos entre cuentas propias (p.ej. banco ↔ efectivo): no son ingreso ni gasto real, así
 * que se excluyen por defecto de cálculos de salud financiera (breakeven, burn rate...) donde
 * contarlos distorsionaría el resultado. Las vistas de movimiento bruto (Flujo de caja, Desglose
 * de gastos, Transacciones) SÍ quieren verlos - ahí se pasa includeInternal a isCashflowTransaction
 * en vez de tocar este default. "transfer" (financiación) siempre se excluye aquí: la entrada del
 * propio préstamo no es un gasto, ver financingExpensesByCategory. */
export const NON_CASHFLOW_GROUP_TYPES = new Set(["transfer", "internal"]);

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

/** Ruta jerárquica completa hasta la raíz: "Impuestos > IRPF > Modelo 111", o solo "Agua" si
 * no tiene padre. Soporta cualquier profundidad (protegido contra ciclos). */
export function categoryDisplayLabel(
  cat: Pick<Category, "label" | "parent_id">,
  all: Pick<Category, "id" | "label" | "parent_id">[],
): string {
  const byId = new Map(all.map((c) => [c.id, c]));
  const parts: string[] = [cat.label];
  const seen = new Set<string>();
  let parentId = cat.parent_id;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    parts.unshift(parent.label);
    parentId = parent.parent_id;
  }
  return parts.join(" > ");
}

/** Categorías ordenadas para listas/selects: cada padre seguido inmediatamente de sus
 * descendientes (a cualquier profundidad, recorrido en profundidad). */
export function sortCategoriesHierarchical(categories: Category[]): Category[] {
  const present = new Set(categories.map((c) => c.id));
  const byParent = new Map<string | null, Category[]>();
  for (const c of categories) {
    // Si el padre no está en la lista (p.ej. filtrada), se trata como raíz para no perderlo.
    const key = c.parent_id && present.has(c.parent_id) ? c.parent_id : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order);

  const result: Category[] = [];
  const visit = (parentKey: string | null) => {
    for (const cat of byParent.get(parentKey) ?? []) {
      result.push(cat);
      visit(cat.id);
    }
  };
  visit(null);
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
