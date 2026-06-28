"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChartCard } from "@/components/charts";
import type { Category } from "@/lib/categories";
import { categoryDisplayLabel } from "@/lib/categories";
import { PERIOD_BUCKETS } from "@/lib/recurring";
import type { RecurringExpense } from "@/lib/recurringExpenses";
import type { Contact } from "./actions";
import ContactPicker, { type ContactPickResult } from "./ContactPicker";
import {
  recordRecurringExpense,
  confirmRecurringExpenses,
  updateRecurringExpense,
  setRecurringExpenseStatus,
  deleteRecurringExpense,
  type ConfirmRecurringRow,
} from "./recurringActions";

export type PendingSeriesRow = {
  key: string;
  label: string;
  category: string | null;
  period: string;
  periodDays: number;
  amount: number; // negativo
  occurrences: number;
  lastDate: string;
  /** Texto de banco (concepto + más datos, ya limpios) del último movimiento de la serie —
   * se guarda como patrón del contacto al confirmar. */
  bankPattern: string;
  /** Contacto ya reconocido en el último movimiento de la serie (preselecciona el picker). */
  matchedContactId: number | null;
};

export type ConfirmedExpenseRow = {
  expense: RecurringExpense;
  lastDate: string | null;
  occurrences: number;
  nextDate: string | null;
  daysUntil: number | null;
};

type Props = {
  pending: PendingSeriesRow[];
  confirmed: ConfirmedExpenseRow[];
  archived: RecurringExpense[];
  categories: Category[];
  contacts: Contact[];
};

function fmtDate(d: string): string {
  return d.split("-").reverse().join("/");
}

function fmtEUR(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

function dueLabel(daysUntil: number | null): { text: string; className: string } {
  if (daysUntil === null) return { text: "—", className: "text-navy/40" };
  if (daysUntil < 0) return { text: `vencido hace ${Math.abs(daysUntil)}d`, className: "text-danger font-medium" };
  if (daysUntil === 0) return { text: "hoy", className: "text-danger font-medium" };
  if (daysUntil <= 7) return { text: `en ${daysUntil}d`, className: "text-warning" };
  return { text: `en ${daysUntil}d`, className: "text-navy/50" };
}

type ContactPick = { contactId: number } | { newLabel: string } | null;

function resultToPick(result: ContactPickResult): ContactPick {
  if ("contactId" in result) return { contactId: result.contactId };
  return result.newLabel ? { newLabel: result.newLabel } : null;
}

function pickToLabel(pick: ContactPick, contacts: Contact[]): string {
  if (!pick) return "";
  if ("contactId" in pick) return contacts.find((c) => c.id === pick.contactId)?.label ?? "";
  return pick.newLabel;
}

function pickToInfo(pick: ContactPick, contacts: Contact[]): string {
  if (!pick) return "Elige o crea un contacto para heredar su IVA y retención.";
  if ("contactId" in pick) {
    const c = contacts.find((x) => x.id === pick.contactId);
    return c ? `ℹ️ Hereda IVA: ${c.ivaRate}% / Retención: ${c.retencionRate}%` : "";
  }
  return "ℹ️ Contacto nuevo — sin IVA/retención todavía (edítalo en Configuración › Contactos).";
}

function PendingRow({
  row,
  categories,
  contacts,
  period,
  pick,
  selected,
  busy,
  onPeriodChange,
  onPickChange,
  onToggleSelected,
  onConfirm,
  onIgnore,
}: {
  row: PendingSeriesRow;
  categories: Category[];
  contacts: Contact[];
  period: string;
  pick: ContactPick;
  selected: boolean;
  busy: boolean;
  onPeriodChange: (period: string) => void;
  onPickChange: (pick: ContactPick) => void;
  onToggleSelected: (checked: boolean) => void;
  onConfirm: () => void;
  onIgnore: () => void;
}) {
  const catLabel = row.category ? categories.find((c) => c.value === row.category) : null;

  return (
    <div className="flex items-start gap-3 py-3">
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onToggleSelected(e.target.checked)}
        className="mt-1.5 w-4 h-4 rounded border-navy/[0.25] accent-navy shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-navy truncate">{row.label}</p>
        <p className="text-xs text-navy/45 truncate mb-2">
          detectado {row.period}{catLabel ? ` · ${categoryDisplayLabel(catLabel, categories)}` : ""} · {row.occurrences} pagos · último {fmtDate(row.lastDate)} · {fmtEUR(Math.abs(row.amount))}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-60">
            <ContactPicker
              value={pickToLabel(pick, contacts)}
              contacts={contacts}
              disabled={busy}
              placeholder="Vincular contacto o crear…"
              onPick={(result) => onPickChange(resultToPick(result))}
            />
          </div>
          <select
            value={period}
            disabled={busy}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="text-sm border border-navy/[0.12] rounded-md px-1.5 py-1 focus:outline-none focus:border-primary/40 disabled:opacity-50"
          >
            {PERIOD_BUCKETS.map((b) => (
              <option key={b.label} value={b.label}>{b.label}</option>
            ))}
          </select>
          <button
            onClick={onConfirm}
            disabled={busy || !pick}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-navy rounded-lg hover:bg-navy/85 transition-colors disabled:opacity-40"
          >
            Confirmar
          </button>
          <button
            onClick={onIgnore}
            disabled={busy}
            className="px-2.5 py-1.5 text-xs font-medium text-navy/45 hover:text-navy transition-colors disabled:opacity-40"
          >
            Ignorar
          </button>
        </div>
        <p className="text-xs text-navy/40 mt-1.5">{pickToInfo(pick, contacts)}</p>
      </div>
    </div>
  );
}

function ConfirmedTableRow({ row, categories, contacts }: { row: ConfirmedExpenseRow; categories: Category[]; contacts: Contact[] }) {
  const e = row.expense;
  const due = dueLabel(row.daysUntil);
  const catLabel = e.category ? categories.find((c) => c.value === e.category) : null;
  const [relinking, setRelinking] = useState(false);
  const router = useRouter();

  const contact = e.contact_id != null ? contacts.find((c) => c.id === e.contact_id) : undefined;
  const displayLabel = contact?.label ?? e.label;

  async function relink(result: ContactPickResult) {
    if (!("contactId" in result)) return; // re-vincular solo a contactos ya existentes desde aquí
    setRelinking(false);
    await updateRecurringExpense(e.id, { contact_id: result.contactId });
    router.refresh();
  }

  async function changePeriod(next: string) {
    const days = PERIOD_BUCKETS.find((b) => b.label === next)?.days ?? e.period_days;
    await updateRecurringExpense(e.id, { period: next, period_days: days });
    router.refresh();
  }

  async function cancel() {
    await setRecurringExpenseStatus(e.id, "cancelled");
    router.refresh();
  }

  return (
    <tr className="border-b border-navy/[0.05] last:border-0">
      <td className="py-2.5 pr-3 align-top">
        <p className="text-sm font-medium text-navy truncate">{displayLabel}</p>
        <p className="text-xs text-navy/45 truncate">{catLabel ? categoryDisplayLabel(catLabel, categories) : "Sin categoría"}</p>
      </td>
      <td className="py-2.5 pr-3 align-top">
        <select
          value={e.period}
          onChange={(ev) => changePeriod(ev.target.value)}
          className="text-sm border border-navy/[0.12] rounded-md px-1.5 py-1 focus:outline-none focus:border-primary/40"
        >
          {PERIOD_BUCKETS.map((b) => (
            <option key={b.label} value={b.label}>{b.label}</option>
          ))}
        </select>
      </td>
      <td className="py-2.5 pr-3 align-top whitespace-nowrap">
        {relinking ? (
          <div className="w-48">
            <ContactPicker
              value={contact?.label ?? ""}
              contacts={contacts}
              placeholder="Nuevo contacto…"
              onPick={relink}
            />
          </div>
        ) : (
          <button
            onClick={() => setRelinking(true)}
            className="text-sm text-navy/70 hover:text-navy underline decoration-dotted decoration-navy/30 transition-colors"
            title="Cambiar contacto vinculado"
          >
            IVA: {e.iva_rate}% / Ret: {e.retencion_rate}%
          </button>
        )}
      </td>
      <td className="py-2.5 pr-3 align-top text-right whitespace-nowrap">
        <p className="text-sm font-semibold text-navy tabular-nums">{fmtEUR(Math.abs(e.amount))}</p>
        <p className={`text-xs tabular-nums ${due.className}`}>{due.text}</p>
      </td>
      <td className="py-2.5 align-top text-right whitespace-nowrap">
        <button onClick={cancel} className="text-xs text-navy/40 hover:text-danger transition-colors">Dar de baja</button>
      </td>
    </tr>
  );
}

function ArchivedRow({ row }: { row: RecurringExpense }) {
  const router = useRouter();
  async function reactivate() {
    await setRecurringExpenseStatus(row.id, "confirmed");
    router.refresh();
  }
  async function remove() {
    await deleteRecurringExpense(row.id);
    router.refresh();
  }
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy/60 truncate">{row.label}</p>
        <p className="text-xs text-navy/40 truncate">
          {row.status === "ignored" ? "Ignorado" : "Dado de baja"} · {fmtEUR(Math.abs(row.amount))} · {row.period}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button onClick={reactivate} className="text-xs text-navy/50 hover:text-navy transition-colors">Reactivar</button>
        <button onClick={remove} className="text-xs text-navy/40 hover:text-danger transition-colors">Eliminar</button>
      </div>
    </div>
  );
}

export default function GastosRecurrentesList({ pending, confirmed, archived, categories, contacts }: Props) {
  const router = useRouter();
  const [periods, setPeriods] = useState<Record<string, string>>({});
  const [picks, setPicks] = useState<Record<string, ContactPick>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function periodFor(row: PendingSeriesRow): string {
    return periods[row.key] ?? row.period;
  }

  function pickFor(row: PendingSeriesRow): ContactPick {
    if (row.key in picks) return picks[row.key];
    return row.matchedContactId != null ? { contactId: row.matchedContactId } : null;
  }

  function buildConfirmRow(row: PendingSeriesRow): ConfirmRecurringRow | null {
    const pick = pickFor(row);
    if (!pick) return null;
    const period = periodFor(row);
    const periodDays = PERIOD_BUCKETS.find((b) => b.label === period)?.days ?? row.periodDays;
    return {
      key: row.key,
      label: row.label,
      category: row.category,
      period,
      period_days: periodDays,
      amount: row.amount,
      bankPattern: row.bankPattern,
      contactId: "contactId" in pick ? pick.contactId : null,
      newContactLabel: "newLabel" in pick ? pick.newLabel : null,
    };
  }

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusyKeys((prev) => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setBusyKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  }

  function confirmOne(row: PendingSeriesRow) {
    const confirmRow = buildConfirmRow(row);
    if (!confirmRow) return;
    withBusy(row.key, async () => {
      await confirmRecurringExpenses([confirmRow]);
      router.refresh();
    });
  }

  function ignoreOne(row: PendingSeriesRow) {
    withBusy(row.key, async () => {
      const period = periodFor(row);
      const periodDays = PERIOD_BUCKETS.find((b) => b.label === period)?.days ?? row.periodDays;
      await recordRecurringExpense(
        { key: row.key, label: row.label, category: row.category, period, period_days: periodDays, amount: row.amount, iva_rate: 0, retencion_rate: 0 },
        "ignored",
      );
      router.refresh();
    });
  }

  async function confirmSelected() {
    const rows = pending
      .filter((p) => selected.has(p.key))
      .map(buildConfirmRow)
      .filter((r): r is ConfirmRecurringRow => r != null);
    if (!rows.length) return;
    setBulkBusy(true);
    try {
      await confirmRecurringExpenses(rows);
      setSelected(new Set());
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(pending.map((p) => p.key)) : new Set());
  }

  function toggleOne(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  const allSelected = pending.length > 0 && pending.every((p) => selected.has(p.key));
  const selectableCount = pending.filter((p) => selected.has(p.key) && pickFor(p) != null).length;

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <ChartCard
          title="Gastos detectados"
          subtitle="Hemos detectado estos patrones en tus cuentas. Vincúlalos a un contacto para aplicar sus impuestos automáticamente."
        >
          <div className="flex items-center justify-between gap-3 pb-2.5 mb-1 border-b border-navy/[0.06]">
            <label className="flex items-center gap-2 text-xs text-navy/50 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                className="w-4 h-4 rounded border-navy/[0.25] accent-navy"
              />
              Seleccionar todos
            </label>
            <button
              onClick={confirmSelected}
              disabled={bulkBusy || selectableCount === 0}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-navy rounded-lg hover:bg-navy/85 transition-colors disabled:opacity-40"
            >
              Confirmar seleccionados{selectableCount > 0 ? ` (${selectableCount})` : ""}
            </button>
          </div>
          <div className="divide-y divide-navy/[0.05]">
            {pending.map((row) => (
              <PendingRow
                key={row.key}
                row={row}
                categories={categories}
                contacts={contacts}
                period={periodFor(row)}
                pick={pickFor(row)}
                selected={selected.has(row.key)}
                busy={busyKeys.has(row.key)}
                onPeriodChange={(p) => setPeriods((prev) => ({ ...prev, [row.key]: p }))}
                onPickChange={(p) => setPicks((prev) => ({ ...prev, [row.key]: p }))}
                onToggleSelected={(checked) => toggleOne(row.key, checked)}
                onConfirm={() => confirmOne(row)}
                onIgnore={() => ignoreOne(row)}
              />
            ))}
          </div>
        </ChartCard>
      )}

      <ChartCard
        title="Gastos recurrentes activos"
        subtitle="Próximo pago previsto, IVA deducible y retención aplicable. Para cambiarlos, vincula otro contacto."
      >
        {confirmed.length === 0 ? (
          <p className="text-sm text-navy/45 text-center py-6">Sin gastos recurrentes confirmados todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[11px] text-navy/40 uppercase tracking-wider">
                  <th className="pb-2 pr-3 font-medium">Contacto / Concepto</th>
                  <th className="pb-2 pr-3 font-medium">Periodicidad</th>
                  <th className="pb-2 pr-3 font-medium">Configuración fiscal</th>
                  <th className="pb-2 pr-3 font-medium text-right">Próximo pago</th>
                  <th className="pb-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {confirmed.map((row) => (
                  <ConfirmedTableRow key={row.expense.id} row={row} categories={categories} contacts={contacts} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      {archived.length > 0 && (
        <ChartCard title="Ignorados / dados de baja" subtitle="No se proyectan en la previsión de cashflow">
          <div className="divide-y divide-navy/[0.05]">
            {archived.map((row) => <ArchivedRow key={row.id} row={row} />)}
          </div>
        </ChartCard>
      )}
    </div>
  );
}
