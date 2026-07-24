import { createServerClient } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { economicGroupOf, type EconomicGroup } from "@/lib/economicGroups";
import type { Category } from "@/lib/categories";
export type { EconomicGroup };

export type ContactType = "empleado" | "socio" | "proveedor" | "administracion" | "banco" | null;
export type PaymentMethod = "banco" | "efectivo" | "victor" | "celia" | "olga" | "carles";

export type Transaction = {
  id: string;
  date: string;
  value_date: string | null;
  amount: number;
  balance: number | null;
  concept: string | null;
  bank_details: string | null;
  contact: string | null;
  labels: string | null;
  category: string | null;
  contact_type: ContactType;
  notes: string | null;
  source: string;
  payment_method: PaymentMethod;
  created_at: string;
  deleted_at: string | null;
  iva_rate: number | null;
  retencion_rate: number | null;
};

/** Tipos de categoría que no representan un gasto real (ventas, aportaciones/financiación, traspasos internos). */
const NON_EXPENSE_GROUP_TYPES = new Set(["income", "transfer", "internal"]);

/** Busca la categoría de una transacción por su `value`, sin sensibilidad a mayúsculas/minúsculas
 * (las categorías guardan el value con distinta capitalización según cuándo se crearon). */
export function findCategory(categories: Category[], value: string): Category | undefined {
  const norm = value.toLowerCase();
  return categories.find((c) => c.value.toLowerCase() === norm);
}

/** Si la transacción tiene categoría, ¿representa un gasto? Solo se excluyen las categorías de
 * tipo ingreso/traspaso/interno; cualquier otra categoría (conocida o no) cuenta como gasto. */
function isExpenseCategory(category: string, categories: Category[]): boolean {
  const cat = findCategory(categories, category);
  return !cat || !NON_EXPENSE_GROUP_TYPES.has(cat.group_type);
}

/** Gastos de financiación: categorías de tipo "transfer" (p.ej. cuotas de préstamo), que
 * `expensesByCategoryAll` excluye a propósito para no mezclarlas con traspasos internos
 * reales. Aquí sí cuentan como gasto real - solo el pago (importe negativo), nunca la
 * entrada del propio préstamo - para poder mostrarlas aparte en el desglose de gastos. */
export function financingExpensesByCategory(txns: Transaction[], categories: Category[]) {
  const map = new Map<string, { count: number; total: number }>();
  for (const t of txns) {
    if (t.amount >= 0 || !t.category) continue;
    const cat = findCategory(categories, t.category);
    if (!cat || cat.group_type !== "transfer") continue;
    const d = map.get(t.category) ?? { count: 0, total: 0 };
    d.count++;
    d.total += Math.abs(t.amount);
    map.set(t.category, d);
  }
  return [...map.entries()].map(([category, d]) => ({ category, ...d, group: "financiacion" as const }));
}


export async function loadCategoryCounts(): Promise<Record<string, number>> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("category")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!row.category) continue;
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  }
  return counts;
}

export async function getLatestImportDate(): Promise<string | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("transactions")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data?.created_at ?? null;
}

export async function loadTransactions(
  from?: string | null,
  to?: string | null,
): Promise<Transaction[]> {
  const supabase = createServerClient();
  let query = supabase.from("transactions").select("*").is("deleted_at", null).order("date", { ascending: false });
  if (from) query = query.gte("date", from);
  if (to)   query = query.lte("date", to);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Transaction[];
}

export const loadTransactionsCached = unstable_cache(
  (from?: string | null, to?: string | null) => loadTransactions(from, to),
  ["transactions"],
  { revalidate: 300, tags: ["transactions"] },
);

export function expensesByMonth(txns: Transaction[], categories: Category[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.amount >= 0 || !t.category) continue;
    if (!isExpenseCategory(t.category, categories)) continue;
    const month = t.date.slice(0, 7);
    map.set(month, (map.get(month) ?? 0) + Math.abs(t.amount));
  }
  return map;
}

/** Gastos por categoría (operativos + CapEx), cada uno con su grupo económico. Cualquier
 * transacción con categoría cuenta, salvo que esa categoría sea de tipo ingreso/traspaso/interno. */
export function expensesByCategoryAll(txns: Transaction[], categories: Category[]) {
  const map = new Map<string, { count: number; total: number; group: EconomicGroup }>();
  for (const t of txns) {
    if (t.amount >= 0 || t.category === null) continue;
    if (!isExpenseCategory(t.category, categories)) continue;
    const cat = findCategory(categories, t.category);
    const d = map.get(t.category) ?? { count: 0, total: 0, group: economicGroupOf(cat?.label ?? t.category, cat?.economic_group) };
    d.count++;
    d.total += Math.abs(t.amount);
    map.set(t.category, d);
  }
  return [...map.entries()]
    .map(([category, d]) => ({ category, ...d }))
    .sort((a, b) => b.total - a.total);
}
