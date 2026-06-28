import { Suspense } from "react";
import { loadTransactionsCached } from "@/lib/transactions";
import { loadCategoriesCached } from "@/lib/categories";
import { getDateRange } from "@/lib/dateRange";
import { detectRecurringTransactions, findRecurringSeries, projectNextDate } from "@/lib/recurring";
import { loadRecurringExpensesCached } from "@/lib/recurringExpenses";
import { contactKeyFor, matchesPattern } from "@/lib/contactRules";
import { getContacts, type Contact } from "./actions";
import TransaccionesTabs from "./TransaccionesTabs";
import type { ConfirmedExpenseRow, PendingSeriesRow } from "./RecurrentesList";
import MobileNav from "@/app/components/MobileNav";

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TransaccionesPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const isCustom = sp.range === "custom" && (sp.from || sp.to);
  const { from, to } = isCustom
    ? { from: sp.from ?? null, to: sp.to ?? null }
    : getDateRange(sp.range);

  const [transactions, categories, allTimeTransactions, contacts, expenses] = await Promise.all([
    loadTransactionsCached(from, to),
    loadCategoriesCached(),
    loadTransactionsCached(null, null),
    getContacts(),
    loadRecurringExpensesCached(),
  ]);

  const uncategorizedCount = transactions.filter((t) => !t.category).length;
  const recurringPeriods   = Object.fromEntries(detectRecurringTransactions(transactions, categories));
  const allMonthKeys = [...new Set(allTimeTransactions.map((t) => t.date.slice(0, 7)))]
    .sort()
    .reverse();

  // ── Recurrentes ──
  const series = findRecurringSeries(allTimeTransactions, categories);
  const seriesByKey = new Map(series.map((s) => [s.key, s]));
  const expenseByKey = new Map(expenses.map((e) => [e.key, e]));

  // Filtra gastos ya confirmados/ignorados antes de este fix cuya categoría sea de
  // ingreso (p. ej. "Ingresos Stripe"), para que no sigan apareciendo aunque ya
  // estuvieran guardados en recurring_expenses.
  const nonOperationalLabels = new Set(
    categories.filter((c) => c.group_type !== "operational").map((c) => c.label),
  );
  const isExpenseRow = (e: { category: string | null }) =>
    !e.category || !nonOperationalLabels.has(e.category);

  // Empareja por patrón bancario (no solo por nombre exacto): la misma serie puede aparecer
  // dos veces si parte de sus movimientos son anteriores a tener el contacto asignado y
  // conservan códigos/referencias en el texto — el patrón ya limpio (bankPattern) sí coincide
  // con los conceptos guardados del contacto aunque la "label" visible todavía no.
  function findMatchedContact(bankPattern: string, label: string): Contact | undefined {
    return (
      contacts.find((c) => c.patterns.some((p) => matchesPattern(bankPattern, p))) ??
      contacts.find((c) => c.label.toLowerCase() === label.toLowerCase())
    );
  }

  // Fusiona en una sola fila las series que en realidad son el mismo gasto recurrente
  // detectado dos veces (mismo contacto reconocido + mismo importe), típicamente porque parte
  // de los movimientos son anteriores a tener el contacto asignado y conservan un texto de
  // banco algo distinto. Si no se fusionaran, cada variante pediría confirmarse por separado
  // aunque ya apuntaran al mismo contacto.
  type PendingGroup = { keys: string[]; bankPatterns: string[]; contact: Contact | undefined; series: typeof series };
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

  const pendingRecurring: PendingSeriesRow[] = [...pendingGroups.values()].map((g) => {
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

  const confirmedRecurring: ConfirmedExpenseRow[] = expenses
    .filter((e) => e.status === "confirmed" && isExpenseRow(e))
    .map((e) => {
      const s = seriesByKey.get(e.key);
      const lastDate = s ? s.transactions[s.transactions.length - 1].date : null;
      const projection = lastDate ? projectNextDate(lastDate, e.period_days) : null;
      return {
        expense: e,
        lastDate,
        occurrences: s?.transactions.length ?? 0,
        nextDate: projection?.nextDate ?? null,
        daysUntil: projection?.daysUntil ?? null,
      };
    })
    .sort((a, b) => (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity));

  const archivedRecurring = expenses.filter((e) => e.status !== "confirmed" && isExpenseRow(e));

  return (
    <div>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MobileNav />
            <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Transacciones</h1>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-2 sm:px-6 pt-[11px] sm:pt-4 pb-16 max-w-6xl mx-auto">
        <Suspense fallback={null}>
          <TransaccionesTabs
            transactions={transactions}
            categories={categories}
            uncategorizedCount={uncategorizedCount}
            recurringPeriods={recurringPeriods}
            recurringExpenses={expenses}
            allMonthKeys={allMonthKeys}
            contacts={contacts}
            pendingRecurring={pendingRecurring}
            confirmedRecurring={confirmedRecurring}
            archivedRecurring={archivedRecurring}
          />
        </Suspense>
      </div>
    </div>
  );
}
