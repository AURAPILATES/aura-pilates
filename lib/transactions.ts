import { createServerClient } from "@/lib/supabase";

export type ContactType = "empleado" | "socio" | "proveedor" | "administracion" | "banco" | null;

export type Transaction = {
  id: string;
  date: string;
  amount: number;
  balance: number | null;
  concept: string | null;
  contact: string | null;
  labels: string | null;
  category: string;
  contact_type: ContactType;
  notes: string | null;
  source: string;
  created_at: string;
};

const OPERATIONAL_CATS = new Set([
  "Alquiler",
  "Salarios",
  "Electricidad",
  "Agua",
  "Software",
  "Gestoría y legal",
  "Impuestos y tasas",
  "Teléfono",
  "Seguros",
  "Comisiones bancarias",
  "Merchandising",
  "Local",
  "Otros",
]);

const STARTUP_CATS = new Set([
  "Inversión",
  "Material y maquinaria",
  "Mobiliario",
  "Reforma",
]);

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
  let query = supabase.from("transactions").select("*").order("date", { ascending: false });
  if (from) query = query.gte("date", from);
  if (to)   query = query.lte("date", to);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as Transaction[];
}

export function totalOperationalExpenses(txns: Transaction[]): number {
  return txns
    .filter((t) => t.amount < 0 && OPERATIONAL_CATS.has(t.category))
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

export function totalStartupCosts(txns: Transaction[]): number {
  return txns
    .filter((t) => t.amount < 0 && STARTUP_CATS.has(t.category))
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

export function expensesByMonth(txns: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.amount >= 0) continue;
    if (!OPERATIONAL_CATS.has(t.category) && !STARTUP_CATS.has(t.category)) continue;
    const month = t.date.slice(0, 7);
    map.set(month, (map.get(month) ?? 0) + Math.abs(t.amount));
  }
  return map;
}

export function operationalExpensesByCategory(txns: Transaction[]) {
  const map = new Map<string, { count: number; total: number }>();
  for (const t of txns) {
    if (t.amount < 0 && OPERATIONAL_CATS.has(t.category)) {
      const d = map.get(t.category) ?? { count: 0, total: 0 };
      d.count++;
      d.total += Math.abs(t.amount);
      map.set(t.category, d);
    }
  }
  return [...map.entries()]
    .map(([category, d]) => ({ category, ...d }))
    .sort((a, b) => b.total - a.total);
}
