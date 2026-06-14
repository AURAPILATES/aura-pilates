import { createServerClient } from "./supabase";

export type Budget = {
  id: string;
  name: string;
  limit: number;
  contactKeyword: string;
};

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
        position: i,
      }))
    );
  }
}

export function computeSpent(
  budgets: Budget[],
  txns: { contact: string | null; amount: number }[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const b of budgets) {
    const kw = b.contactKeyword.trim().toLowerCase();
    if (!kw) { result[b.id] = 0; continue; }
    result[b.id] = txns
      .filter((t) => t.contact?.toLowerCase().includes(kw))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }
  return result;
}
