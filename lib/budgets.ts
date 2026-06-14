import fs from "fs";
import path from "path";

export type Budget = {
  id: string;
  name: string;
  limit: number;
  contactKeyword: string;
};

const FILE = path.join(process.cwd(), "data", "budgets.json");

export function loadBudgets(): Budget[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8")) as Budget[];
  } catch {
    return [];
  }
}

export function saveBudgets(budgets: Budget[]): void {
  fs.writeFileSync(FILE, JSON.stringify(budgets, null, 2), "utf-8");
}

export function computeSpent(
  budgets: Budget[],
  txns: { contact: string | null; amount: number }[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const b of budgets) {
    const kw = b.contactKeyword.trim().toLowerCase();
    if (!kw) {
      result[b.id] = 0;
      continue;
    }
    result[b.id] = txns
      .filter((t) => t.contact?.toLowerCase().includes(kw))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }
  return result;
}
