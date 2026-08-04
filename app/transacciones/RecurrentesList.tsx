"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronRight } from "react-feather";
import Drawer from "@/app/components/Drawer";
import Button, { SecondaryButton, DangerButton, DangerButtonSolid } from "@/app/components/Button";
import Select from "@/app/components/Select";
import type { Category } from "@/lib/categories";
import { PERIOD_BUCKETS } from "@/lib/recurring";
import { normalizeText } from "@/lib/normalizeText";
import type { RecurringExpense, RecurringExpenseEndType } from "@/lib/recurringExpenses";
import type { Contact } from "./actions";
import { CategoryBadge, CategoryPill } from "./TransaccionesList";
import type { ContactPickResult } from "./ContactPicker";
import RecurrentesListV2 from "./RecurrentesListV2";
import {
  recordRecurringExpense,
  confirmRecurringExpenses,
  createManualRecurringExpense,
  updateRecurringExpense,
  relinkRecurringExpenseContact,
  relinkRecurringExpensesContact,
  updateRecurringExpensesCategory,
  deleteRecurringExpenses,
  setRecurringExpenseStatus,
  type ConfirmRecurringRow,
  type ManualRecurringInput,
} from "./recurringActions";

export type PendingSeriesRow = {
  /** Una fila puede agrupar varias series detectadas que en realidad son el mismo gasto
   * (mismo contacto + mismo importe, separadas porque parte de los movimientos no tenían el
   * contacto asignado todavía) - se usa keys[0] como identificador estable de la fila. */
  keys: string[];
  label: string;
  category: string | null;
  period: string;
  periodDays: number;
  amount: number; // negativo
  occurrences: number;
  lastDate: string;
  /** Textos de banco (concepto + más datos, ya limpios) de cada serie agrupada - se guardan
   * como patrones del contacto al confirmar. */
  bankPatterns: string[];
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

const PAGE_SIZE = 100;

export function fmtDate(d: string): string {
  return d.split("-").reverse().join("/");
}

export function fmtEUR(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
}

function initials(label: string): string {
  return label.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** Avatar circular consistente con el resto de la app (ver iniciales en ContactDetailDrawer de
 * Configuración > Contactos): coloreado cuando hay un contacto vinculado, neutro si no. */
export function ContactAvatar({ label, resolved, size = 36 }: { label: string; resolved: boolean; size?: number }) {
  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center font-semibold ${resolved ? "bg-primary/10 text-primary" : "bg-navy/[0.05] text-navy/30"}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.32) }}
    >
      {resolved && label ? initials(label) : "?"}
    </div>
  );
}


export type ContactPick = { contactId: number } | { newLabel: string } | null;

function resultToPick(result: ContactPickResult): ContactPick {
  if ("contactId" in result) return { contactId: result.contactId };
  return result.newLabel ? { newLabel: result.newLabel } : null;
}

export function pickToLabel(pick: ContactPick, contacts: Contact[]): string {
  if (!pick) return "";
  if ("contactId" in pick) return contacts.find((c) => c.id === pick.contactId)?.label ?? "";
  return pick.newLabel;
}

function pickToInfo(pick: ContactPick, contacts: Contact[]): string {
  if (!pick) return "Elige o crea un contacto para heredar su IVA y retención.";
  if ("contactId" in pick) {
    const c = contacts.find((x) => x.id === pick.contactId);
    return c ? `Hereda de ${c.label}: IVA ${c.ivaRate}% · Retención ${c.retencionRate}%` : "";
  }
  return "Contacto nuevo - sin IVA/retención todavía (edítalo en Configuración › Contactos).";
}

const END_TYPE_OPTIONS: { value: RecurringExpenseEndType; label: string }[] = [
  { value: "never", label: "Nunca" },
  { value: "date", label: "En una fecha" },
  { value: "count", label: "Tras X repeticiones" },
];

type EndFields = { type: RecurringExpenseEndType; date: string; count: string };

function defaultEnd(): EndFields {
  return { type: "never", date: "", count: "" };
}

function endFromExpense(e: RecurringExpense): EndFields {
  return {
    type: e.end_type,
    date: e.end_date ?? "",
    count: e.end_count != null ? String(e.end_count) : "",
  };
}

/** Mismo control de "Finaliza" que el detalle de movimiento (TransactionDrawer): periodo
 * indefinido, hasta una fecha, o tras X repeticiones. */
function EndOfRecurrenceFields({ value, onChange, disabled }: { value: EndFields; onChange: (next: EndFields) => void; disabled?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Finaliza</p>
      <Select
        value={value.type}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, type: e.target.value as RecurringExpenseEndType })}
      >
        {END_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
      {value.type === "date" && (
        <input
          type="date"
          value={value.date}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          className="w-full mt-2 px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40 disabled:opacity-50"
        />
      )}
      {value.type === "count" && (
        <input
          type="number"
          min={1}
          value={value.count}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, count: e.target.value })}
          placeholder="Número de repeticiones"
          className="w-full mt-2 px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40 disabled:opacity-50"
        />
      )}
    </div>
  );
}

/** Al pulsar "Confirmar" en un pendiente directamente desde la tabla (sin abrir el detalle),
 * preguntamos primero si la recurrencia lleva fecha de finalización o número de repeticiones -
 * por defecto es indefinida. Reutiliza el mismo control "Finaliza" que los drawers para no
 * divergir. Se monta en <body> vía portal para que el overlay `fixed` cubra el viewport aunque
 * el botón que lo abre viva dentro de una tabla/tarjeta con contexto de posicionamiento. */
function ConfirmEndDatePrompt({ row, onConfirm, onClose }: {
  row: PendingSeriesRow;
  onConfirm: (end: EndFields) => Promise<void>;
  onClose: () => void;
}) {
  const [end, setEnd] = useState<EndFields>(defaultEnd());
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleConfirm() {
    setSaving(true);
    try { await onConfirm(end); onClose(); } finally { setSaving(false); }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-navy/[0.07]">
          <h2 className="text-base font-bold text-navy">¿Fecha de finalización?</h2>
          <p className="text-xs text-navy/45 mt-0.5 truncate">
            {row.label} · {fmtEUR(Math.abs(row.amount))} · <span className="capitalize">{row.period}</span>
          </p>
        </div>
        <div className="px-5 py-4">
          <EndOfRecurrenceFields value={end} onChange={setEnd} disabled={saving} />
          <p className="text-xs text-navy/40 mt-3">Por defecto es indefinida. Puedes cambiarlo más tarde en el detalle.</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-navy/[0.07]">
          <SecondaryButton onClick={onClose} disabled={saving}>
            Cancelar
          </SecondaryButton>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Confirmando…" : "Confirmar recurrente"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Drawer de búsqueda/creación de contacto, abierto desde el detalle de un pendiente o de un
 * confirmado para vincular/cambiar el contacto sin ensuciar la fila con un combobox inline. */
function ContactPickerDrawer({ contacts, title, onPick, onClose }: {
  contacts: Contact[];
  title?: string;
  onPick: (result: ContactPickResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const nq = normalizeText(query).trim();

  const filtered = useMemo(() => {
    const sorted = [...contacts].sort((a, b) => a.label.localeCompare(b.label));
    return nq ? sorted.filter((c) => normalizeText(c.label).includes(nq)) : sorted;
  }, [contacts, nq]);

  const exact = contacts.some((c) => c.label.toLowerCase() === q);

  return (
    <Drawer title={title ?? "Vincular contacto"} subtitle="Busca uno guardado o crea uno nuevo" onClose={onClose} maxWidth="max-w-sm">
      <div className="px-4 pt-4 pb-2">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar contacto…"
          className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
        />
      </div>
      <div className="px-2 pb-4">
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => { onPick({ contactId: c.id, label: c.label }); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-navy/[0.03] transition-colors text-left"
          >
            <ContactAvatar label={c.label} resolved size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-navy truncate">{c.label}</p>
              <p className="text-[11px] text-navy/40">IVA {c.ivaRate}% · Ret {c.retencionRate}%</p>
            </div>
          </button>
        ))}
        {query.trim() && !exact && (
          <button
            onClick={() => { onPick({ newLabel: query.trim() }); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg hover:bg-primary/[0.06] transition-colors text-left text-primary text-sm font-medium border-t border-navy/[0.06]"
          >
            + Crear contacto &ldquo;{query.trim()}&rdquo;
          </button>
        )}
        {filtered.length === 0 && !query.trim() && (
          <p className="text-xs text-navy/40 px-3 py-4">Todavía no hay contactos guardados.</p>
        )}
      </div>
    </Drawer>
  );
}

function ConfirmPendingDrawer({ row, period, pick, end, name, ivaRate, retencionRate, contacts, onClose, onPeriodChange, onEndChange, onNameChange, onOpenContactPicker, onConfirm, onIgnore }: {
  row: PendingSeriesRow;
  period: string;
  pick: ContactPick;
  end: EndFields;
  name: string;
  ivaRate: number;
  retencionRate: number;
  contacts: Contact[];
  onClose: () => void;
  onPeriodChange: (period: string) => void;
  onEndChange: (end: EndFields) => void;
  onNameChange: (name: string) => void;
  onOpenContactPicker: () => void;
  onConfirm: () => Promise<void>;
  onIgnore: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const label = pickToLabel(pick, contacts);

  async function handleConfirm(close: () => void) {
    setSaving(true);
    try { await onConfirm(); close(); } finally { setSaving(false); }
  }
  async function handleIgnore(close: () => void) {
    setSaving(true);
    try { await onIgnore(); close(); } finally { setSaving(false); }
  }

  return (
    <Drawer
      onClose={onClose}
      header={
        <div className="flex items-start gap-3">
          <ContactAvatar label={name || row.label} resolved={!!pick} size={40} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy truncate">{name || row.label}</p>
            <p className="text-xs text-navy/45 mt-0.5">{row.occurrences} pagos detectados · último {fmtDate(row.lastDate)}</p>
          </div>
        </div>
      }
      footer={(close) => (
        <div className="flex gap-3">
          <SecondaryButton onClick={() => handleIgnore(close)} disabled={saving} className="flex-1">
            Ignorar
          </SecondaryButton>
          <Button onClick={() => handleConfirm(close)} disabled={saving || !pick} className="flex-1">
            Confirmar gasto recurrente
          </Button>
        </div>
      )}
    >
      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Importe</p>
        <p className="text-lg font-semibold text-navy">{fmtEUR(Math.abs(row.amount))}</p>
        <p className="text-xs text-navy/40 mt-0.5">detectado {row.period} · {row.occurrences} pagos</p>
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Concepto / Nombre</p>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
        />
        <p className="text-xs text-navy/40 mt-2">Puede ser distinto del contacto vinculado.</p>
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Contacto</p>
        <button
          onClick={onOpenContactPicker}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-navy/15 rounded-lg hover:border-primary/40 transition-colors text-left"
        >
          <span className={`text-sm truncate ${pick ? "text-navy font-medium" : "text-navy/40"}`}>
            {label || "Elegir o crear contacto…"}
          </span>
          <ChevronRight size={14} className="text-navy/30 shrink-0" />
        </button>
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">IVA y retención</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-navy/40">IVA %</label>
            <p className="w-full mt-1 px-3 py-2 text-sm text-navy bg-navy/[0.03] rounded-lg tabular-nums">{ivaRate}%</p>
          </div>
          <div>
            <label className="text-xs text-navy/40">Retención %</label>
            <p className="w-full mt-1 px-3 py-2 text-sm text-navy bg-navy/[0.03] rounded-lg tabular-nums">{retencionRate}%</p>
          </div>
        </div>
        <p className="text-xs text-navy/40 mt-2">{pickToInfo(pick, contacts)} Se edita en Configuración › Contactos.</p>
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Periodicidad</p>
        <Select value={period} onChange={(e) => onPeriodChange(e.target.value)}>
          {PERIOD_BUCKETS.map((b) => (
            <option key={b.label} value={b.label}>{b.label}</option>
          ))}
        </Select>
      </div>

      <div className="p-4">
        <EndOfRecurrenceFields value={end} onChange={onEndChange} />
      </div>
    </Drawer>
  );
}

/** Alta manual de un gasto recurrente sin transacción real detrás - para anticipar un gasto
 * futuro conocido (ej. "en 2 meses empiezo a pagar X"). A diferencia de ConfirmPendingDrawer,
 * aquí todos los campos parten en blanco: no hay una serie detectada de la que copiar importe,
 * periodo o contacto sugerido. */
function NewManualRecurringDrawer({ categories, contacts, pick, onOpenContactPicker, onClose, onCreate }: {
  categories: Category[];
  contacts: Contact[];
  pick: ContactPick;
  onOpenContactPicker: () => void;
  onClose: () => void;
  onCreate: (input: ManualRecurringInput) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [period, setPeriod] = useState("mensual");
  const [anchorDate, setAnchorDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState<EndFields>(defaultEnd());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickLabel = pickToLabel(pick, contacts);

  async function handleCreate(close: () => void) {
    if (!label.trim()) { setError("Falta el nombre."); return; }
    const parsed = parseFloat(amount.replace(",", ".")) || 0;
    if (!parsed) { setError("Falta el importe."); return; }
    if (!anchorDate) { setError("Falta la fecha de referencia."); return; }
    setSaving(true);
    setError(null);
    try {
      const periodDays = PERIOD_BUCKETS.find((b) => b.label === period)?.days ?? 30;
      await onCreate({
        label: label.trim(),
        category,
        period,
        period_days: periodDays,
        amount: -Math.abs(parsed),
        anchorDate,
        contactId: pick && "contactId" in pick ? pick.contactId : null,
        newContactLabel: pick && "newLabel" in pick ? pick.newLabel : null,
        endType: end.type,
        endDate: end.type === "date" ? end.date || null : null,
        endCount: end.type === "count" ? parseInt(end.count, 10) || null : null,
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      title="Nuevo recurrente"
      subtitle="Sin transacción todavía - para anticipar un gasto futuro conocido"
      onClose={onClose}
      footer={(close) => (
        <div className="flex gap-2">
          <SecondaryButton onClick={close} className="flex-1">
            Cancelar
          </SecondaryButton>
          <Button onClick={() => handleCreate(close)} disabled={saving} className="flex-1">
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      )}
    >
      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Nombre</p>
        <input
          type="text"
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ej. Alquiler local nuevo"
          className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
        />
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Importe</p>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="w-32 px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
          />
          <span className="text-sm text-navy/40">€</span>
        </div>
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Categoría</p>
        <CategoryPill category={category} categories={categories} onChange={setCategory} />
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Contacto (opcional)</p>
        <button
          onClick={onOpenContactPicker}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-navy/15 rounded-lg hover:border-primary/40 transition-colors text-left"
        >
          <span className={`text-sm truncate ${pick ? "text-navy font-medium" : "text-navy/40"}`}>
            {pickLabel || "Elegir o crear contacto…"}
          </span>
          <ChevronRight size={14} className="text-navy/30 shrink-0" />
        </button>
        <p className="text-xs text-navy/40 mt-2">{pickToInfo(pick, contacts)}</p>
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Periodicidad</p>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIOD_BUCKETS.map((b) => (
            <option key={b.label} value={b.label}>{b.label}</option>
          ))}
        </Select>
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Fecha de referencia</p>
        <input
          type="date"
          value={anchorDate}
          onChange={(e) => setAnchorDate(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
        />
        <p className="text-xs text-navy/40 mt-2">Último pago conocido, o el próximo previsto si aún no ha empezado - desde aquí se proyecta el siguiente.</p>
      </div>

      <div className="p-4">
        <EndOfRecurrenceFields value={end} onChange={setEnd} />
      </div>

      {error && <p className="px-4 pb-4 text-xs text-danger">{error}</p>}
    </Drawer>
  );
}

function RecurringExpenseDrawer({ row, categories, contacts, onClose, onOpenContactPicker }: {
  row: ConfirmedExpenseRow;
  categories: Category[];
  contacts: Contact[];
  onClose: () => void;
  onOpenContactPicker: () => void;
}) {
  const e = row.expense;
  const router = useRouter();
  const catLabel = e.category ? categories.find((c) => c.value === e.category) : null;
  const contact = e.contact_id != null ? contacts.find((c) => c.id === e.contact_id) : undefined;
  const contactLabel = contact?.label ?? "Sin vincular";
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [end, setEnd] = useState<EndFields>(() => endFromExpense(e));
  const [name, setName] = useState(e.label);
  const [amountDraft, setAmountDraft] = useState(String(Math.abs(e.amount)));
  const ivaRate = contact?.ivaRate ?? 0;
  const retencionRate = contact?.retencionRate ?? 0;

  async function changeLabel() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === e.label) { setName(e.label); return; }
    setSaving(true);
    try {
      await updateRecurringExpense(e.id, { label: trimmed });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function changeAmount() {
    const parsed = parseFloat(amountDraft.replace(",", ".")) || 0;
    const next = -Math.abs(parsed);
    setAmountDraft(String(Math.abs(next)));
    if (next === e.amount) return;
    setSaving(true);
    try {
      await updateRecurringExpense(e.id, { amount: next });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function changePeriod(next: string) {
    const days = PERIOD_BUCKETS.find((b) => b.label === next)?.days ?? e.period_days;
    setSaving(true);
    try {
      await updateRecurringExpense(e.id, { period: next, period_days: days });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function changeEnd(next: EndFields) {
    setEnd(next);
    setSaving(true);
    try {
      await updateRecurringExpense(e.id, {
        end_type: next.type,
        end_date: next.type === "date" ? next.date || null : null,
        end_count: next.type === "count" ? parseInt(next.count, 10) || null : null,
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    await setRecurringExpenseStatus(e.id, "cancelled");
    router.refresh();
    onClose();
  }

  return (
    <Drawer
      onClose={onClose}
      header={
        <div className="flex items-start gap-3">
          <ContactAvatar label={e.label} resolved={!!contact} size={40} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy truncate">{e.label}</p>
            {catLabel && <div className="mt-1"><CategoryBadge category={e.category} categories={categories} /></div>}
          </div>
        </div>
      }
      footer={
        confirmCancel ? (
          <div className="flex gap-3">
            <SecondaryButton onClick={() => setConfirmCancel(false)} className="flex-1">Cancelar</SecondaryButton>
            <DangerButtonSolid onClick={cancel} className="flex-1">Confirmar baja</DangerButtonSolid>
          </div>
        ) : (
          <div className="flex gap-3">
            <DangerButton onClick={() => setConfirmCancel(true)}>Dar de baja</DangerButton>
            <Button onClick={onClose} className="flex-1">Guardar</Button>
          </div>
        )
      }
    >
      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Importe</p>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            inputMode="decimal"
            value={amountDraft}
            disabled={saving}
            onChange={(ev) => setAmountDraft(ev.target.value)}
            onBlur={changeAmount}
            className="w-32 px-3 py-2 text-sm font-semibold text-navy border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40 disabled:opacity-50"
          />
          <span className="text-sm text-navy/40">€</span>
        </div>
        {row.lastDate ? (
          <p className="text-xs text-navy/40 mt-2">
            {e.manual && row.occurrences === 0 ? "Fecha de referencia" : "Último pago"}: {fmtDate(row.lastDate)}
          </p>
        ) : (
          e.manual && <p className="text-xs text-navy/40 mt-2">Sin transacciones todavía - pendiente de que llegue el primer pago real.</p>
        )}
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Concepto / Nombre</p>
        <input
          type="text"
          value={name}
          disabled={saving}
          onChange={(ev) => setName(ev.target.value)}
          onBlur={changeLabel}
          className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40 disabled:opacity-50"
        />
        <p className="text-xs text-navy/40 mt-2">Nombre de esta recurrencia - puede ser distinto del contacto vinculado.</p>
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Contacto vinculado</p>
        <button
          onClick={onOpenContactPicker}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-navy/15 rounded-lg hover:border-primary/40 transition-colors text-left"
        >
          <span className="text-sm text-navy font-medium truncate">{contactLabel}</span>
          <span className="text-xs text-primary shrink-0">Cambiar</span>
        </button>
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">IVA y retención</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-navy/40">IVA %</label>
            <p className="w-full mt-1 px-3 py-2 text-sm text-navy bg-navy/[0.03] rounded-lg tabular-nums">{ivaRate}%</p>
          </div>
          <div>
            <label className="text-xs text-navy/40">Retención %</label>
            <p className="w-full mt-1 px-3 py-2 text-sm text-navy bg-navy/[0.03] rounded-lg tabular-nums">{retencionRate}%</p>
          </div>
        </div>
        <p className="text-xs text-navy/40 mt-2">
          {contact ? (
            <>
              Heredado de {contact.label}. Se edita en{" "}
              <button
                type="button"
                onClick={() => router.push(`/configuracion?tab=contactos&contacto=${contact.id}`)}
                className="text-primary hover:underline"
              >
                Configuración › Contactos
              </button>
              .
            </>
          ) : (
            "Sin contacto vinculado. Se edita en Configuración › Contactos."
          )}
        </p>
      </div>

      <div className="p-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-1.5">Periodicidad</p>
        <Select value={e.period} disabled={saving} onChange={(ev) => changePeriod(ev.target.value)}>
          {PERIOD_BUCKETS.map((b) => (
            <option key={b.label} value={b.label}>{b.label}</option>
          ))}
        </Select>
      </div>

      <div className="p-4">
        <EndOfRecurrenceFields value={end} onChange={changeEnd} disabled={saving} />
      </div>
    </Drawer>
  );
}

export default function GastosRecurrentesList({ pending, confirmed, archived, categories, contacts }: Props) {
  const router = useRouter();
  const [periods, setPeriods] = useState<Record<string, string>>({});
  const [picks, setPicks] = useState<Record<string, ContactPick>>({});
  const [ends, setEnds] = useState<Record<string, EndFields>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [openPendingKey, setOpenPendingKey] = useState<string | null>(null);
  const [openConfirmedId, setOpenConfirmedId] = useState<number | null>(null);
  // Pendiente para el que se pregunta la fecha de finalización antes de confirmarlo desde la tabla.
  const [endPromptKey, setEndPromptKey] = useState<string | null>(null);
  const [creatingManual, setCreatingManual] = useState(false);
  const [manualPick, setManualPick] = useState<ContactPick>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmedPage, setConfirmedPage] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // En móvil no hay paginador (lista corta, no aporta cortarla en páginas), así que ahí se
  // muestran todos los confirmados de golpe.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const q = normalizeText(search).trim();
  const filteredPending = useMemo(
    () => (q ? pending.filter((p) => normalizeText(p.label).includes(q)) : pending),
    [pending, q],
  );
  const filteredConfirmed = useMemo(
    () => (q ? confirmed.filter((c) => normalizeText(c.expense.label).includes(q)) : confirmed),
    [confirmed, q],
  );

  function handleSearchChange(value: string) {
    setSearch(value);
    setConfirmedPage(0);
  }

  const confirmedPageRows = isMobile
    ? filteredConfirmed
    : filteredConfirmed.slice(confirmedPage * PAGE_SIZE, (confirmedPage + 1) * PAGE_SIZE);

  const openPendingRow = openPendingKey != null ? pending.find((p) => p.keys[0] === openPendingKey) ?? null : null;
  const openConfirmedRow = openConfirmedId != null ? confirmed.find((c) => c.expense.id === openConfirmedId) ?? null : null;
  const endPromptRow = endPromptKey != null ? pending.find((p) => p.keys[0] === endPromptKey) ?? null : null;

  function periodFor(row: PendingSeriesRow): string {
    return periods[row.keys[0]] ?? row.period;
  }

  function endFor(row: PendingSeriesRow): EndFields {
    return ends[row.keys[0]] ?? defaultEnd();
  }

  function nameFor(row: PendingSeriesRow): string {
    return names[row.keys[0]] ?? row.label;
  }

  function pickFor(row: PendingSeriesRow): ContactPick {
    if (row.keys[0] in picks) return picks[row.keys[0]];
    return row.matchedContactId != null ? { contactId: row.matchedContactId } : null;
  }

  /** Siempre hereda el IVA/retención del contacto vinculado - no editable por recurrencia,
   * para que un cambio en la ficha del contacto se refleje sin desincronizarse. */
  function ivaRateFor(row: PendingSeriesRow): number {
    const pick = pickFor(row);
    if (pick && "contactId" in pick) {
      return contacts.find((c) => c.id === pick.contactId)?.ivaRate ?? 0;
    }
    return 0;
  }

  function retencionRateFor(row: PendingSeriesRow): number {
    const pick = pickFor(row);
    if (pick && "contactId" in pick) {
      return contacts.find((c) => c.id === pick.contactId)?.retencionRate ?? 0;
    }
    return 0;
  }

  function buildConfirmRow(row: PendingSeriesRow, endOverride?: EndFields): ConfirmRecurringRow | null {
    const pick = pickFor(row);
    if (!pick) return null;
    const period = periodFor(row);
    const periodDays = PERIOD_BUCKETS.find((b) => b.label === period)?.days ?? row.periodDays;
    const end = endOverride ?? endFor(row);
    return {
      keys: row.keys,
      label: nameFor(row),
      category: row.category,
      period,
      period_days: periodDays,
      amount: row.amount,
      bankPatterns: row.bankPatterns,
      contactId: "contactId" in pick ? pick.contactId : null,
      newContactLabel: "newLabel" in pick ? pick.newLabel : null,
      ivaRate: ivaRateFor(row),
      retencionRate: retencionRateFor(row),
      endType: end.type,
      endDate: end.type === "date" ? end.date || null : null,
      endCount: end.type === "count" ? parseInt(end.count, 10) || null : null,
    };
  }

  async function confirmRow(row: PendingSeriesRow, endOverride?: EndFields) {
    const confirmRowPayload = buildConfirmRow(row, endOverride);
    if (!confirmRowPayload) return;
    await confirmRecurringExpenses([confirmRowPayload]);
    router.refresh();
  }

  async function ignoreRow(row: PendingSeriesRow) {
    const period = periodFor(row);
    const periodDays = PERIOD_BUCKETS.find((b) => b.label === period)?.days ?? row.periodDays;
    await recordRecurringExpense(
      { keys: row.keys, label: nameFor(row), category: row.category, period, period_days: periodDays, amount: row.amount, iva_rate: 0, retencion_rate: 0 },
      "ignored",
    );
    router.refresh();
  }

  async function handlePickerPick(result: ContactPickResult) {
    if (creatingManual) {
      setManualPick(resultToPick(result));
    } else if (openPendingRow) {
      const pick = resultToPick(result);
      setPicks((prev) => ({ ...prev, [openPendingRow.keys[0]]: pick }));
    } else if (openConfirmedRow) {
      const relinkPick = "contactId" in result ? { contactId: result.contactId } : { newContactLabel: result.newLabel };
      await relinkRecurringExpenseContact(openConfirmedRow.expense.id, relinkPick);
      router.refresh();
    }
  }

  async function handleCreateManual(input: ManualRecurringInput) {
    await createManualRecurringExpense(input);
    router.refresh();
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }
  function toggleSelectAll(ids: number[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  }
  async function applyBulkContact(contactId: number) {
    const ids = [...selectedIds];
    clearSelection();
    await relinkRecurringExpensesContact(ids, contactId);
    router.refresh();
  }
  async function applyBulkCategory(category: string | null) {
    const ids = [...selectedIds];
    clearSelection();
    await updateRecurringExpensesCategory(ids, category);
    router.refresh();
  }
  async function applyBulkDelete() {
    const ids = [...selectedIds];
    clearSelection();
    await deleteRecurringExpenses(ids);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <RecurrentesListV2
        pending={filteredPending}
        confirmed={filteredConfirmed}
        confirmedPageRows={confirmedPageRows}
        archived={archived}
        categories={categories}
        contacts={contacts}
        search={search}
        onSearchChange={handleSearchChange}
        pickFor={pickFor}
        ivaRateFor={ivaRateFor}
        retencionRateFor={retencionRateFor}
        onOpenPending={(row) => setOpenPendingKey(row.keys[0])}
        onOpenConfirmed={(row) => setOpenConfirmedId(row.expense.id)}
        onConfirmRow={(row) => { setEndPromptKey(row.keys[0]); return Promise.resolve(); }}
        confirmedPage={confirmedPage}
        pageSize={PAGE_SIZE}
        onConfirmedPageChange={setConfirmedPage}
        onNewManual={() => setCreatingManual(true)}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onClearSelection={clearSelection}
        onBulkContact={applyBulkContact}
        onBulkCategory={applyBulkCategory}
        onBulkDelete={applyBulkDelete}
      />
      {openPendingRow && (
        <ConfirmPendingDrawer
          row={openPendingRow}
          period={periodFor(openPendingRow)}
          pick={pickFor(openPendingRow)}
          end={endFor(openPendingRow)}
          name={nameFor(openPendingRow)}
          ivaRate={ivaRateFor(openPendingRow)}
          retencionRate={retencionRateFor(openPendingRow)}
          contacts={contacts}
          onClose={() => setOpenPendingKey(null)}
          onPeriodChange={(p) => setPeriods((prev) => ({ ...prev, [openPendingRow.keys[0]]: p }))}
          onEndChange={(end) => setEnds((prev) => ({ ...prev, [openPendingRow.keys[0]]: end }))}
          onNameChange={(n) => setNames((prev) => ({ ...prev, [openPendingRow.keys[0]]: n }))}
          onOpenContactPicker={() => setPickerOpen(true)}
          onConfirm={() => confirmRow(openPendingRow)}
          onIgnore={() => ignoreRow(openPendingRow)}
        />
      )}

      {openConfirmedRow && (
        <RecurringExpenseDrawer
          row={openConfirmedRow}
          categories={categories}
          contacts={contacts}
          onClose={() => setOpenConfirmedId(null)}
          onOpenContactPicker={() => setPickerOpen(true)}
        />
      )}

      {endPromptRow && (
        <ConfirmEndDatePrompt
          row={endPromptRow}
          onConfirm={(end) => confirmRow(endPromptRow, end)}
          onClose={() => setEndPromptKey(null)}
        />
      )}

      {creatingManual && (
        <NewManualRecurringDrawer
          categories={categories}
          contacts={contacts}
          pick={manualPick}
          onOpenContactPicker={() => setPickerOpen(true)}
          onClose={() => { setCreatingManual(false); setManualPick(null); }}
          onCreate={handleCreateManual}
        />
      )}

      {pickerOpen && (
        <ContactPickerDrawer
          contacts={contacts}
          title={openConfirmedRow ? "Cambiar contacto vinculado" : "Vincular contacto"}
          onClose={() => setPickerOpen(false)}
          onPick={handlePickerPick}
        />
      )}
    </div>
  );
}
