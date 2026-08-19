import { createServerClient } from "./supabase";
import { unstable_cache, revalidateTag } from "next/cache";

export type Budget = {
  id: string;
  name: string;
  limit: number;
  contactKeyword: string;
  /** Palabras clave comparadas directamente contra concepto/"más datos" de cada movimiento
   * (sin pasar por Contactos) - para bancos que mandan un concepto genérico + una referencia
   * numérica que el reconocimiento de contactos descarta por parecer un código variable. */
  bankKeywords: string[];
};

export const loadBudgetsCached = unstable_cache(
  () => loadBudgets(),
  ["budgets"],
  { revalidate: 3600, tags: ["budgets"] },
);

export async function loadBudgets(): Promise<Budget[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from("budgets")
    .select("*")
    .order("position", { ascending: true });
  if (error) {
    console.error("loadBudgets error:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    limit: Number(row.limit),
    contactKeyword: row.contact_keyword,
    bankKeywords: ((row.bank_keywords ?? "") as string).split(",").map((s) => s.trim()).filter(Boolean),
  }));
}

export async function saveBudgets(budgets: Budget[]): Promise<void> {
  const db = createServerClient();
  await db.from("budgets").delete().not("id", "is", null);
  if (budgets.length > 0) {
    await db.from("budgets").insert(
      budgets.map((b, i) => ({
        id: b.id,
        name: b.name,
        limit: b.limit,
        contact_keyword: b.contactKeyword,
        bank_keywords: (b.bankKeywords ?? []).join(", ") || null,
        position: i,
      }))
    );
  }
  revalidateTag("budgets");
}

export function computeSpent(
  budgets: Budget[],
  txns: { contact: string | null; concept: string | null; bank_details: string | null; amount: number }[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const b of budgets) {
    const kw = b.contactKeyword.trim().toLowerCase();
    // (b.bankKeywords ?? []): un Budget cacheado antes de añadir este campo (unstable_cache
    // puede servir la forma vieja hasta que caduque/se resalve) no lo trae todavía.
    const bankKws = (b.bankKeywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean);
    if (!kw && bankKws.length === 0) { result[b.id] = 0; continue; }
    result[b.id] = txns
      .filter((t) => {
        // Solo salidas: sin este filtro, el propio desembolso del préstamo (importe positivo)
        // cuenta como "gastado" si comparte contacto/palabra clave con las cuotas (probable,
        // mismo banco) - mismo criterio que financingExpensesByCategory en lib/transactions.ts.
        if (t.amount >= 0) return false;
        if (kw && t.contact?.toLowerCase().includes(kw)) return true;
        if (bankKws.length === 0) return false;
        const concept = t.concept?.toLowerCase() ?? "";
        const details = t.bank_details?.toLowerCase() ?? "";
        return bankKws.some((k) => concept.includes(k) || details.includes(k));
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }
  return result;
}
