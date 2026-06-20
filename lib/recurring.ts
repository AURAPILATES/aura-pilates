import type { Transaction } from "./transactions";

const MONTH_NAMES_RE = /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/g;

function normalizeConcept(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(MONTH_NAMES_RE, "")
    .replace(/[0-9]+/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function groupKey(t: Transaction): string | null {
  const contact = t.contact?.toLowerCase().trim();
  if (contact) return `c:${contact}`;
  const concept = normalizeConcept(t.concept);
  return concept ? `n:${concept}` : null;
}

// período → {días esperados, tolerancia en días}
const PERIOD_BUCKETS: { label: string; days: number; tolerance: number }[] = [
  { label: "semanal",    days: 7,   tolerance: 2 },
  { label: "quincenal",  days: 14,  tolerance: 3 },
  { label: "mensual",    days: 30,  tolerance: 4 },
  { label: "bimestral",  days: 60,  tolerance: 6 },
  { label: "trimestral", days: 91,  tolerance: 7 },
  { label: "semestral",  days: 182, tolerance: 10 },
  { label: "anual",      days: 365, tolerance: 12 },
];

function matchPeriod(days: number): string | null {
  for (const b of PERIOD_BUCKETS) {
    if (Math.abs(days - b.days) <= b.tolerance) return b.label;
  }
  return null;
}

/**
 * Un movimiento es recurrente si existe otro con el mismo importe, el mismo
 * contacto (o concepto igual/parecido si no hay contacto) y una separación
 * temporal que se repite siempre con el mismo período (semanal, mensual...).
 * Devuelve un mapa id de transacción → período detectado.
 */
export function detectRecurringTransactions(transactions: Transaction[]): Map<string, string> {
  const groups = new Map<string, Map<number, Transaction[]>>(); // groupKey → amountCents → txns

  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const key = groupKey(t);
    if (!key) continue;
    const amountCents = Math.round(Math.abs(t.amount) * 100);
    if (!groups.has(key)) groups.set(key, new Map());
    const byAmount = groups.get(key)!;
    if (!byAmount.has(amountCents)) byAmount.set(amountCents, []);
    byAmount.get(amountCents)!.push(t);
  }

  const result = new Map<string, string>();
  for (const byAmount of groups.values()) {
    for (const txns of byAmount.values()) {
      if (txns.length < 2) continue;
      const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const d1 = new Date(sorted[i - 1].date + "T00:00:00");
        const d2 = new Date(sorted[i].date + "T00:00:00");
        gaps.push(Math.round((d2.getTime() - d1.getTime()) / 86400000));
      }
      const periods = gaps.map(matchPeriod);
      if (periods.some((p) => p === null)) continue;
      const period = periods[0]!;
      if (!periods.every((p) => p === period)) continue;
      for (const t of sorted) result.set(t.id, period);
    }
  }
  return result;
}
