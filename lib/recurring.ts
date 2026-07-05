import type { Transaction } from "./transactions";
import type { Category } from "./categories";
import { contactKeyFor, matchesPattern } from "./contactRules";

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

export function displayLabel(t: Transaction): string {
  return t.contact?.trim() || t.concept?.trim() || "Sin nombre";
}

/** Misma clave que agrupa series en `findRecurringSeries`, para poder dar de alta
 * manualmente un gasto recurrente desde un único movimiento (sin esperar a que el
 * heurístico detecte 2+ pagos). Null si el movimiento no tiene contacto ni concepto. */
export function seriesKeyFor(t: Transaction): string | null {
  const key = groupKey(t);
  if (!key) return null;
  const amountCents = Math.round(Math.abs(t.amount) * 100);
  return `${key}:${amountCents}`;
}

// período → {días esperados, tolerancia en días}
export const PERIOD_BUCKETS: { label: string; days: number; tolerance: number }[] = [
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

export type RecurringSeries = {
  key: string;
  label: string;
  category: string | null;
  period: string;
  periodDays: number;
  amount: number; // negativo
  transactions: Transaction[]; // orden ascendente por fecha
};

/**
 * Agrupa los movimientos de gasto (importe negativo) por contacto (o concepto si no hay
 * contacto) + importe exacto, y se queda con los grupos cuya separación temporal entre
 * pagos se repite siempre con el mismo período (semanal, mensual...). Es la base tanto del
 * badge "recurrente" en Movimientos como de la previsión de gastos en Analítica.
 *
 * Si se pasan `categories`, se excluyen los movimientos cuya categoría no sea de tipo
 * "operational" (p. ej. "Ingresos Stripe" es income, no un gasto, aunque a veces tenga
 * importe negativo por cómo se registra el cobro/comisión).
 */
export function findRecurringSeries(transactions: Transaction[], categories?: Category[]): RecurringSeries[] {
  const groups = new Map<string, Map<number, Transaction[]>>(); // groupKey → amountCents → txns
  const nonOperationalLabels = categories
    ? new Set(categories.filter((c) => c.group_type !== "operational").map((c) => c.label))
    : null;

  for (const t of transactions) {
    if (t.amount >= 0) continue;
    if (t.category && nonOperationalLabels?.has(t.category)) continue;
    const key = groupKey(t);
    if (!key) continue;
    const amountCents = Math.round(Math.abs(t.amount) * 100);
    if (!groups.has(key)) groups.set(key, new Map());
    const byAmount = groups.get(key)!;
    if (!byAmount.has(amountCents)) byAmount.set(amountCents, []);
    byAmount.get(amountCents)!.push(t);
  }

  const series: RecurringSeries[] = [];
  for (const byAmount of groups.values()) {
    for (const [amountCents, txns] of byAmount) {
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
      const bucket = PERIOD_BUCKETS.find((b) => b.label === period)!;
      const last = sorted[sorted.length - 1];
      series.push({
        key: `${groupKey(last)}:${amountCents}`,
        label: displayLabel(last),
        category: last.category,
        period,
        periodDays: bucket.days,
        amount: -(amountCents / 100),
        transactions: sorted,
      });
    }
  }
  return series;
}

/**
 * Un movimiento es recurrente si existe otro con el mismo importe, el mismo
 * contacto (o concepto igual/parecido si no hay contacto) y una separación
 * temporal que se repite siempre con el mismo período (semanal, mensual...).
 * Devuelve un mapa id de transacción → período detectado.
 */
export function detectRecurringTransactions(transactions: Transaction[], categories?: Category[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const s of findRecurringSeries(transactions, categories)) {
    for (const t of s.transactions) result.set(t.id, s.period);
  }
  return result;
}

export type RecurringForecast = {
  key: string;
  label: string;
  category: string | null;
  period: string;
  amount: number; // negativo
  lastDate: string;
  nextDate: string;
  daysUntil: number; // negativo = vencido
  occurrences: number;
};

export type PendingRecurringGroup = {
  /** Una fila puede agrupar varias series detectadas que en realidad son el mismo gasto
   * (mismo contacto + mismo importe, separadas porque parte de los movimientos no tenían el
   * contacto asignado todavía) — se usa keys[0] como identificador estable de la fila. */
  keys: string[];
  label: string;
  category: string | null;
  period: string;
  periodDays: number;
  amount: number; // negativo
  occurrences: number;
  lastDate: string;
  /** Textos de banco (concepto + más datos, ya limpios) de cada serie agrupada — se guardan
   * como patrones del contacto al confirmar. */
  bankPatterns: string[];
  /** Contacto ya reconocido en el último movimiento de la serie (preselecciona el picker). */
  matchedContactId: number | null;
};

type ContactLike = { id: number; label: string; patterns: string[] };
type RecurringExpenseLike = { key: string; status: string; contact_id: number | null; label: string; amount: number };

/**
 * Series recurrentes detectadas que todavía no están confirmadas como gasto recurrente.
 * Fusiona series que en realidad son el mismo gasto (mismo contacto/patrón + importe, pero
 * key distinta porque parte de los movimientos son anteriores a tener el contacto asignado), y
 * descarta las que ya están confirmadas bajo otra key (mismo contacto+importe o etiqueta+importe).
 * Es la fuente única tanto para la lista de la pestaña "Recurrentes" como para el contador de
 * la sidebar — deben coincidir siempre.
 */
export function computePendingRecurring(
  transactions: Transaction[],
  categories: Category[],
  expenses: RecurringExpenseLike[],
  contacts: ContactLike[],
): PendingRecurringGroup[] {
  const series = findRecurringSeries(transactions, categories);
  const expenseByKey = new Set(expenses.map((e) => e.key));

  function findMatchedContact(bankPattern: string, label: string): ContactLike | undefined {
    return (
      contacts.find((c) => c.patterns.some((p) => matchesPattern(bankPattern, p))) ??
      contacts.find((c) => c.label.toLowerCase() === label.toLowerCase())
    );
  }

  type PendingGroup = { keys: string[]; bankPatterns: string[]; contact: ContactLike | undefined; series: RecurringSeries[] };
  const pendingGroups = new Map<string, PendingGroup>();
  for (const s of series) {
    if (expenseByKey.has(s.key)) continue;
    const last = s.transactions[s.transactions.length - 1];
    const bankPattern = contactKeyFor(last.concept, last.bank_details);
    const contact = findMatchedContact(bankPattern, s.label);
    const amountCents = Math.round(Math.abs(s.amount) * 100);
    const groupKey = `${contact ? `c:${contact.id}` : `p:${bankPattern}`}:${amountCents}`;
    const group = pendingGroups.get(groupKey) ?? { keys: [], bankPatterns: [], contact, series: [] };
    group.keys.push(s.key);
    group.bankPatterns.push(bankPattern);
    group.series.push(s);
    pendingGroups.set(groupKey, group);
  }

  const confirmedByContactAmount = new Set<string>();
  const confirmedByLabelAmount = new Set<string>();
  for (const e of expenses) {
    if (e.status !== "confirmed") continue;
    const amountCents = Math.round(Math.abs(e.amount) * 100);
    if (e.contact_id != null) confirmedByContactAmount.add(`${e.contact_id}:${amountCents}`);
    confirmedByLabelAmount.add(`${e.label.toLowerCase()}:${amountCents}`);
  }
  function alreadyConfirmed(g: PendingGroup): boolean {
    const amountCents = Math.round(Math.abs(g.series[0].amount) * 100);
    if (g.contact && confirmedByContactAmount.has(`${g.contact.id}:${amountCents}`)) return true;
    const label = (g.contact?.label ?? g.series[0].label).toLowerCase();
    return confirmedByLabelAmount.has(`${label}:${amountCents}`);
  }

  return [...pendingGroups.values()].filter((g) => !alreadyConfirmed(g)).map((g) => {
    const byRecency = [...g.series].sort((a, b) =>
      b.transactions[b.transactions.length - 1].date.localeCompare(a.transactions[a.transactions.length - 1].date),
    );
    const primary = byRecency[0];
    const occurrences = g.series.reduce((sum, s) => sum + s.transactions.length, 0);
    return {
      keys: g.keys,
      label: g.contact?.label ?? primary.label,
      category: primary.category,
      period: primary.period,
      periodDays: primary.periodDays,
      amount: primary.amount,
      occurrences,
      lastDate: primary.transactions[primary.transactions.length - 1].date,
      bankPatterns: [...new Set(g.bankPatterns)],
      matchedContactId: g.contact?.id ?? null,
    };
  });
}

/** Ancla a mediodía local: evita que toISOString() (UTC) recorte un día en zonas con offset
 * positivo (ej. Madrid en verano), donde la medianoche local cae en el día anterior en UTC. */
function referenceToday(referenceDate?: string): Date {
  return referenceDate
    ? new Date(referenceDate + "T12:00:00")
    : (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12); })();
}

/** Proyecta la próxima fecha de pago a partir de la última fecha conocida + período. */
export function projectNextDate(
  lastDate: string,
  periodDays: number,
  referenceDate?: string,
): { nextDate: string; daysUntil: number } {
  const today = referenceToday(referenceDate);
  const next = new Date(lastDate + "T12:00:00");
  next.setDate(next.getDate() + periodDays);
  const daysUntil = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  return { nextDate: next.toISOString().slice(0, 10), daysUntil };
}

