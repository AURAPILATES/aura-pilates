import { createServerClient } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { economicGroupOf, type EconomicGroup } from "@/lib/economicGroups";
import { NON_CASHFLOW_GROUP_TYPES, type Category } from "@/lib/categories";
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
  /** Marca manual "Es una devolución" (p.ej. una comisión y su condonación en otro movimiento
   * aparte): se excluye de ingresos/gastos en todos los cálculos, ver isCashflowTransaction. */
  is_refund: boolean;
  /** Movimiento contrario vinculado (mismo importe en signo opuesto), si se encontró/eligió al
   * marcar "Es una devolución". Los dos lados se mantienen en sincronía, ver setTransactionRefund. */
  refund_link_id: string | null;
};

/** Tipos de categoría que no representan un gasto real (ventas, aportaciones/financiación, traspasos internos). */
const NON_EXPENSE_GROUP_TYPES = new Set(["income", "transfer", "internal"]);

/** ¿Es este movimiento un ingreso de Urban Sports Club? Urban paga por transferencia (no por
 * Stripe) y se reconoce por su contacto: al importar, el concepto "Urban" se enlaza al contacto
 * "Urban Sports". Por eso Urban se calcula desde el banco, nunca desde Stripe ni desde el CSV. */
export function isUrbanIncome(t: Transaction): boolean {
  return t.amount > 0 && /urban/i.test(t.contact ?? "");
}

/** Ingresos de Urban por mes ("YYYY-MM" → importe), a partir de las transacciones del banco. */
export function urbanRevenueByMonth(txns: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (!isUrbanIncome(t) || t.is_refund) continue;
    const m = t.date.slice(0, 7);
    map.set(m, (map.get(m) ?? 0) + t.amount);
  }
  return map;
}

/** "YYYY-MM" del mes anterior a una fecha ISO. */
function prevMonth(dateISO: string): string {
  const [y, m] = dateISO.slice(0, 7).split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${pad2seg(m - 1)}`;
}
function pad2seg(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Ingresos de Urban por MES DE ACTIVIDAD ("YYYY-MM" → importe): cada transferencia se asigna al
 * mes anterior a su fecha, porque Urban paga a mes vencido (transferencia del 12-14 de M paga las
 * clases de M-1; verificado con el histórico del banco). Es el criterio del gráfico de Ventas por
 * Fuente, que alinea el € con las clases del mes; IVA/breakeven/transacciones siguen usando
 * urbanRevenueByMonth (criterio de caja: el mes en que el dinero llega). */
export function urbanRevenueByActivityMonth(txns: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (!isUrbanIncome(t) || t.is_refund) continue;
    const m = prevMonth(t.date);
    map.set(m, (map.get(m) ?? 0) + t.amount);
  }
  return map;
}

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

/** ¿Cuenta este movimiento como ingreso/gasto real "según el banco"? No cuentan los traspasos
 * internos/financiación (ver NON_CASHFLOW_GROUP_TYPES) ni los movimientos marcados a mano como
 * "Devolución" - su contrapartida ya vive en otro movimiento aparte (p.ej. una comisión de
 * tarjeta y su condonación), así que contar ambos sumaría o restaría de más. Se usa en todos
 * los cálculos de ingresos/gastos de Analítica y en los totales de Transacciones. */
export function isCashflowTransaction(
  t: Pick<Transaction, "category" | "is_refund">,
  categories: Category[],
): boolean {
  if (t.is_refund) return false;
  const cat = t.category ? findCategory(categories, t.category) : undefined;
  return !cat || !NON_CASHFLOW_GROUP_TYPES.has(cat.group_type);
}

/** Gastos de financiación: categorías de tipo "transfer" (p.ej. cuotas de préstamo), que
 * `expensesByCategoryAll` excluye a propósito para no mezclarlas con traspasos internos
 * reales. Aquí sí cuentan como gasto real - solo el pago (importe negativo), nunca la
 * entrada del propio préstamo - para poder mostrarlas aparte en el desglose de gastos. */
export function financingExpensesByCategory(txns: Transaction[], categories: Category[]) {
  const map = new Map<string, { count: number; total: number }>();
  for (const t of txns) {
    if (t.amount >= 0 || !t.category || t.is_refund) continue;
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

export const getLatestImportDate = unstable_cache(
  async (): Promise<string | null> => {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("transactions")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return data?.created_at ?? null;
  },
  ["latest-import-date"],
  { revalidate: 300, tags: ["transactions"] },
);

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
    if (t.amount >= 0 || !t.category || t.is_refund) continue;
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
    if (t.amount >= 0 || t.category === null || t.is_refund) continue;
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
