"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChartCard } from "@/components/charts";
import type { Category } from "@/lib/categories";
import { categoryDisplayLabel } from "@/lib/categories";
import type { RecurringExpense } from "@/lib/recurringExpenses";
import { recordRecurringExpense, updateRecurringExpense, setRecurringExpenseStatus, deleteRecurringExpense } from "./actions";

export type PendingSeriesRow = {
  key: string;
  label: string;
  category: string | null;
  period: string;
  periodDays: number;
  amount: number; // negativo
  occurrences: number;
  lastDate: string;
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
};

function fmtDate(d: string): string {
  return d.split("-").reverse().join("/");
}

function fmtEUR(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

function dueLabel(daysUntil: number | null): { text: string; className: string } {
  if (daysUntil === null) return { text: "—", className: "text-navy/40" };
  if (daysUntil < 0) return { text: `vencido hace ${Math.abs(daysUntil)}d`, className: "text-warning" };
  if (daysUntil === 0) return { text: "hoy", className: "text-danger font-medium" };
  if (daysUntil <= 7) return { text: `en ${daysUntil}d`, className: "text-warning" };
  return { text: `en ${daysUntil}d`, className: "text-navy/50" };
}

function RateInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = parseFloat(draft.replace(",", "."));
        if (!isNaN(n) && n !== value) onSave(n);
        else setDraft(String(value));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setDraft(String(value)); (e.target as HTMLInputElement).blur(); }
      }}
      className="w-16 text-sm text-center border border-navy/[0.12] rounded-md px-1.5 py-1 focus:outline-none focus:border-primary/40 tabular-nums"
    />
  );
}

function PendingRow({ row, categories }: { row: PendingSeriesRow; categories: Category[] }) {
  const [ivaRate, setIvaRate] = useState("21");
  const [retencionRate, setRetencionRate] = useState("0");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const catLabel = row.category ? categories.find((c) => c.value === row.category) : null;

  async function handle(status: "confirmed" | "ignored") {
    setSaving(true);
    try {
      await recordRecurringExpense(
        {
          key: row.key,
          label: row.label,
          category: row.category,
          period: row.period,
          period_days: row.periodDays,
          amount: row.amount,
          iva_rate: status === "confirmed" ? parseFloat(ivaRate.replace(",", ".")) || 0 : 0,
          retencion_rate: status === "confirmed" ? parseFloat(retencionRate.replace(",", ".")) || 0 : 0,
        },
        status,
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy truncate">{row.label}</p>
        <p className="text-xs text-navy/45 truncate">
          {row.period}{catLabel ? ` · ${categoryDisplayLabel(catLabel, categories)}` : ""} · {row.occurrences} pagos · último {fmtDate(row.lastDate)} · {fmtEUR(Math.abs(row.amount))}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <label className="text-xs text-navy/45">IVA %</label>
        <input
          type="text" inputMode="decimal" value={ivaRate} onChange={(e) => setIvaRate(e.target.value)}
          className="w-12 text-sm text-center border border-navy/[0.12] rounded-md px-1 py-1 focus:outline-none focus:border-primary/40"
        />
        <label className="text-xs text-navy/45">Ret. %</label>
        <input
          type="text" inputMode="decimal" value={retencionRate} onChange={(e) => setRetencionRate(e.target.value)}
          className="w-12 text-sm text-center border border-navy/[0.12] rounded-md px-1 py-1 focus:outline-none focus:border-primary/40"
        />
        <button
          onClick={() => handle("confirmed")}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-navy rounded-lg hover:bg-navy/85 transition-colors disabled:opacity-40"
        >
          Confirmar
        </button>
        <button
          onClick={() => handle("ignored")}
          disabled={saving}
          className="px-2.5 py-1.5 text-xs font-medium text-navy/45 hover:text-navy transition-colors disabled:opacity-40"
        >
          Ignorar
        </button>
      </div>
    </div>
  );
}

function ConfirmedRow({ row, categories }: { row: ConfirmedExpenseRow; categories: Category[] }) {
  const e = row.expense;
  const due = dueLabel(row.daysUntil);
  const catLabel = e.category ? categories.find((c) => c.value === e.category) : null;
  const router = useRouter();

  async function save(data: Parameters<typeof updateRecurringExpense>[1]) {
    await updateRecurringExpense(e.id, data);
    router.refresh();
  }

  async function cancel() {
    await setRecurringExpenseStatus(e.id, "cancelled");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-navy truncate">{e.label}</p>
        <p className="text-xs text-navy/45 truncate">
          {e.period}{catLabel ? ` · ${categoryDisplayLabel(catLabel, categories)}` : ""} · {row.occurrences} pagos
          {row.lastDate ? ` · último ${fmtDate(row.lastDate)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-navy/45">IVA</span>
          <RateInput value={e.iva_rate} onSave={(v) => save({ iva_rate: v })} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-navy/45">Ret.</span>
          <RateInput value={e.retencion_rate} onSave={(v) => save({ retencion_rate: v })} />
        </div>
        <div className="text-right w-24">
          <p className="text-sm font-semibold text-navy tabular-nums">{fmtEUR(Math.abs(e.amount))}</p>
          <p className={`text-xs tabular-nums ${due.className}`}>{due.text}</p>
        </div>
        <button
          onClick={cancel}
          className="text-xs text-navy/40 hover:text-danger transition-colors whitespace-nowrap"
        >
          Dar de baja
        </button>
      </div>
    </div>
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

export default function GastosRecurrentesList({ pending, confirmed, archived, categories }: Props) {
  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <ChartCard
          title="Pendientes de confirmar"
          subtitle="Series detectadas automáticamente por importe, contacto/concepto y periodicidad — confirma para fijar IVA y retención"
        >
          <div className="divide-y divide-navy/[0.05]">
            {pending.map((row) => <PendingRow key={row.key} row={row} categories={categories} />)}
          </div>
        </ChartCard>
      )}

      <ChartCard
        title="Gastos recurrentes confirmados"
        subtitle="Próximo pago previsto, IVA deducible y retención aplicable"
      >
        {confirmed.length === 0 ? (
          <p className="text-sm text-navy/45 text-center py-6">Sin gastos recurrentes confirmados todavía.</p>
        ) : (
          <div className="divide-y divide-navy/[0.05]">
            {confirmed.map((row) => <ConfirmedRow key={row.expense.id} row={row} categories={categories} />)}
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
