"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "react-feather";
import Drawer from "@/app/components/Drawer";
import TablePagination from "@/app/components/TablePagination";
import TableBox from "@/app/components/TableBox";
import Button from "@/app/components/Button";
import Select from "@/app/components/Select";
import type { Category } from "@/lib/categories";
import { PERIOD_BUCKETS } from "@/lib/recurring";
import type { RecurringExpense, RecurringExpenseEndType } from "@/lib/recurringExpenses";
import type { Contact } from "./actions";
import { CategoryBadge } from "./TransaccionesList";
import type { ContactPickResult } from "./ContactPicker";
import { useDesignVersion } from "@/app/components/DesignVersionContext";
import RecurrentesListV2 from "./RecurrentesListV2";
import {
  recordRecurringExpense,
  confirmRecurringExpenses,
  updateRecurringExpense,
  relinkRecurringExpenseContact,
  setRecurringExpenseStatus,
  deleteRecurringExpense,
  type ConfirmRecurringRow,
} from "./recurringActions";

export type PendingSeriesRow = {
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

const PAGE_SIZE = 25;

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
  return "Contacto nuevo — sin IVA/retención todavía (edítalo en Configuración › Contactos).";
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

  const filtered = useMemo(() => {
    const sorted = [...contacts].sort((a, b) => a.label.localeCompare(b.label));
    return q ? sorted.filter((c) => c.label.toLowerCase().includes(q)) : sorted;
  }, [contacts, q]);

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

function PendingRow({ row, categories, contacts, pick, onOpen }: {
  row: PendingSeriesRow;
  categories: Category[];
  contacts: Contact[];
  pick: ContactPick;
  onOpen: () => void;
}) {
  const catLabel = row.category ? categories.find((c) => c.value === row.category) : null;
  const label = pickToLabel(pick, contacts);

  return (
    <button onClick={onOpen} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-navy/[0.02] transition-colors text-left">
      <ContactAvatar label={label || row.label} resolved={!!pick} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-navy truncate">{row.label}</p>
        <p className="text-xs text-navy/45 truncate mt-0.5">
          {row.period} · {row.occurrences} pagos · último {fmtDate(row.lastDate)} · {fmtEUR(Math.abs(row.amount))}
        </p>
      </div>
      {catLabel && <CategoryBadge category={row.category} categories={categories} />}
      {(!pick || label !== row.label) && (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${pick ? "bg-primary/10 text-primary" : "bg-navy/[0.05] text-navy/40"}`}>
          {pick ? label : "Sin vincular"}
        </span>
      )}
      <ChevronRight size={16} className="text-navy/25 shrink-0" />
    </button>
  );
}

function ConfirmPendingDrawer({ row, period, pick, end, name, ivaRate, retencionRate, contacts, onClose, onPeriodChange, onEndChange, onNameChange, onIvaRateChange, onRetencionRateChange, onOpenContactPicker, onConfirm, onIgnore }: {
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
  onIvaRateChange: (rate: number) => void;
  onRetencionRateChange: (rate: number) => void;
  onOpenContactPicker: () => void;
  onConfirm: () => Promise<void>;
  onIgnore: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const label = pickToLabel(pick, contacts);

  async function handleConfirm() {
    setSaving(true);
    try { await onConfirm(); onClose(); } finally { setSaving(false); }
  }
  async function handleIgnore() {
    setSaving(true);
    try { await onIgnore(); onClose(); } finally { setSaving(false); }
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
      footer={
        <div className="flex items-center justify-between gap-2">
          <button onClick={handleIgnore} disabled={saving} className="text-xs text-navy/40 hover:text-danger transition-colors disabled:opacity-40">
            Ignorar
          </button>
          <Button onClick={handleConfirm} disabled={saving || !pick}>
            Confirmar gasto recurrente
          </Button>
        </div>
      }
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
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={ivaRate}
              onChange={(e) => onIvaRateChange(parseFloat(e.target.value) || 0)}
              className="w-full mt-1 px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40 tabular-nums"
            />
          </div>
          <div>
            <label className="text-xs text-navy/40">Retención %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={retencionRate}
              onChange={(e) => onRetencionRateChange(parseFloat(e.target.value) || 0)}
              className="w-full mt-1 px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40 tabular-nums"
            />
          </div>
        </div>
        <p className="text-xs text-navy/40 mt-2">{pickToInfo(pick, contacts)}</p>
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

/** Fila de una sola línea (estilo Linear, ver PrevisionGastos.tsx): sin tabla ni fecha de
 * vencimiento, solo lo estable — contacto, categoría, periodicidad, fiscalidad e importe. */
function ConfirmedRowHeader() {
  return (
    <div className="hidden sm:flex items-center gap-2.5 py-3 px-4 bg-navy/[0.02] border-b border-navy/[0.06]">
      <span className="text-[11px] font-semibold text-navy/45 uppercase tracking-wider flex-1 min-w-0">Concepto</span>
      <span className="shrink-0 text-[11px] font-semibold text-navy/45 uppercase tracking-wider max-w-[140px] w-full">Categoría</span>
      <span className="hidden md:block shrink-0 text-[11px] font-semibold text-navy/45 uppercase tracking-wider w-16 text-right">Periodo</span>
      <span className="hidden lg:block shrink-0 text-[11px] font-semibold text-navy/45 uppercase tracking-wider w-28 text-right">IVA / Ret</span>
      <span className="shrink-0 text-[11px] font-semibold text-navy/45 uppercase tracking-wider w-20 text-right">Importe</span>
    </div>
  );
}

function ConfirmedRow({ row, categories, contacts, onOpen }: { row: ConfirmedExpenseRow; categories: Category[]; contacts: Contact[]; onOpen: () => void }) {
  const e = row.expense;
  const catLabel = e.category ? categories.find((c) => c.value === e.category) : null;
  const contact = e.contact_id != null ? contacts.find((c) => c.id === e.contact_id) : undefined;
  const showContact = contact && contact.label.trim().toLowerCase() !== e.label.trim().toLowerCase();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-2.5 py-2.5 px-4 hover:bg-navy/[0.02] transition-colors text-left"
    >
      <span className="text-[13px] font-medium text-navy truncate flex-1 min-w-0">{e.label}</span>
      {showContact && (
        <span className="hidden sm:block shrink-0 text-[11px] text-navy/40 truncate max-w-[120px]">{contact.label}</span>
      )}
      {catLabel && (
        <span className="hidden sm:block shrink-0 max-w-[140px] w-full truncate">
          <CategoryBadge category={e.category} categories={categories} />
        </span>
      )}
      <span className="hidden md:block shrink-0 text-[11px] text-navy/40 capitalize w-16 text-right">{e.period}</span>
      <span className="hidden lg:block shrink-0 text-[11px] text-navy/40 w-28 text-right">
        IVA {e.iva_rate}% / Ret {e.retencion_rate}%
      </span>
      <span className="text-[13px] font-semibold text-navy tabular-nums shrink-0 w-20 text-right">
        {fmtEUR(Math.abs(e.amount))}
      </span>
    </button>
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
  const [ivaRate, setIvaRate] = useState(e.iva_rate);
  const [retencionRate, setRetencionRate] = useState(e.retencion_rate);

  /** Tras re-vincular el contacto (ver onOpenContactPicker) el IVA/retención llegan
   * actualizados por props — se resincroniza aquí en vez de sobreescribirlos en silencio, así
   * el usuario los ve y puede corregirlos antes de que se apliquen a la previsión. */
  useEffect(() => {
    setIvaRate(e.iva_rate);
    setRetencionRate(e.retencion_rate);
  }, [e.iva_rate, e.retencion_rate]);

  async function changeRates(nextIva: number, nextRetencion: number) {
    if (nextIva === e.iva_rate && nextRetencion === e.retencion_rate) return;
    setSaving(true);
    try {
      await updateRecurringExpense(e.id, { iva_rate: nextIva, retencion_rate: nextRetencion });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

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
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setConfirmCancel(false)} className="text-xs text-navy/40 hover:text-navy transition-colors">Cancelar</button>
            <button onClick={cancel} className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors">Confirmar baja</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmCancel(true)}
            className="w-full py-2.5 text-sm font-medium text-danger border border-danger/20 rounded-lg hover:bg-danger/5 transition-colors"
          >
            Dar de baja
          </button>
        )
      }
    >
      <div className="p-4 border-b border-navy/[0.06]">
        <p className="bg-navy/[0.02] rounded-xl px-3 py-2.5 inline-block">
          <span className="block text-[11px] text-navy/40">Importe</span>
          <span className="text-lg font-semibold text-navy">{fmtEUR(Math.abs(e.amount))}</span>
        </p>
        {row.lastDate && <p className="text-xs text-navy/40 mt-2">Último pago: {fmtDate(row.lastDate)}</p>}
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
        <p className="text-xs text-navy/40 mt-2">Nombre de esta recurrencia — puede ser distinto del contacto vinculado.</p>
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
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={ivaRate}
              disabled={saving}
              onChange={(ev) => setIvaRate(parseFloat(ev.target.value) || 0)}
              onBlur={() => changeRates(ivaRate, retencionRate)}
              className="w-full mt-1 px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40 tabular-nums disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-xs text-navy/40">Retención %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={retencionRate}
              disabled={saving}
              onChange={(ev) => setRetencionRate(parseFloat(ev.target.value) || 0)}
              onBlur={() => changeRates(ivaRate, retencionRate)}
              className="w-full mt-1 px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40 tabular-nums disabled:opacity-50"
            />
          </div>
        </div>
        <p className="text-xs text-navy/40 mt-2">Se autocompletan al vincular un contacto — corrígelos si esta recurrencia concreta es distinta.</p>
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
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
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
  const [ends, setEnds] = useState<Record<string, EndFields>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [ivaRates, setIvaRates] = useState<Record<string, number>>({});
  const [retencionRates, setRetencionRates] = useState<Record<string, number>>({});
  const [openPendingKey, setOpenPendingKey] = useState<string | null>(null);
  const [openConfirmedId, setOpenConfirmedId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmedPage, setConfirmedPage] = useState(0);
  const { v2 } = useDesignVersion();

  const confirmedPageRows = confirmed.slice(confirmedPage * PAGE_SIZE, (confirmedPage + 1) * PAGE_SIZE);

  const openPendingRow = openPendingKey != null ? pending.find((p) => p.keys[0] === openPendingKey) ?? null : null;
  const openConfirmedRow = openConfirmedId != null ? confirmed.find((c) => c.expense.id === openConfirmedId) ?? null : null;

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

  /** Por defecto hereda el IVA/retención del contacto vinculado, pero el usuario puede
   * corregirlos en el drawer antes de confirmar (ver ivaRates/retencionRates). */
  function ivaRateFor(row: PendingSeriesRow): number {
    if (row.keys[0] in ivaRates) return ivaRates[row.keys[0]];
    const pick = pickFor(row);
    if (pick && "contactId" in pick) {
      return contacts.find((c) => c.id === pick.contactId)?.ivaRate ?? 0;
    }
    return 0;
  }

  function retencionRateFor(row: PendingSeriesRow): number {
    if (row.keys[0] in retencionRates) return retencionRates[row.keys[0]];
    const pick = pickFor(row);
    if (pick && "contactId" in pick) {
      return contacts.find((c) => c.id === pick.contactId)?.retencionRate ?? 0;
    }
    return 0;
  }

  function buildConfirmRow(row: PendingSeriesRow): ConfirmRecurringRow | null {
    const pick = pickFor(row);
    if (!pick) return null;
    const period = periodFor(row);
    const periodDays = PERIOD_BUCKETS.find((b) => b.label === period)?.days ?? row.periodDays;
    const end = endFor(row);
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

  async function confirmRow(row: PendingSeriesRow) {
    const confirmRowPayload = buildConfirmRow(row);
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
    if (openPendingRow) {
      const pick = resultToPick(result);
      setPicks((prev) => ({ ...prev, [openPendingRow.keys[0]]: pick }));
    } else if (openConfirmedRow) {
      const relinkPick = "contactId" in result ? { contactId: result.contactId } : { newContactLabel: result.newLabel };
      await relinkRecurringExpenseContact(openConfirmedRow.expense.id, relinkPick);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {v2 ? (
        <RecurrentesListV2
          pending={pending}
          confirmed={confirmed}
          confirmedPageRows={confirmedPageRows}
          categories={categories}
          contacts={contacts}
          pickFor={pickFor}
          onOpenPending={(row) => setOpenPendingKey(row.keys[0])}
          onOpenConfirmed={(row) => setOpenConfirmedId(row.expense.id)}
          confirmedPage={confirmedPage}
          pageSize={PAGE_SIZE}
          onConfirmedPageChange={setConfirmedPage}
        />
      ) : (
      <>
      {pending.length > 0 && (
        <TableBox
          title="Gastos detectados"
          subtitle="Vincúlalos a un contacto para aplicar sus impuestos automáticamente."
        >
          <div className="divide-y divide-navy/[0.05]">
            {pending.map((row) => (
              <PendingRow
                key={row.keys[0]}
                row={row}
                categories={categories}
                contacts={contacts}
                pick={pickFor(row)}
                onOpen={() => setOpenPendingKey(row.keys[0])}
              />
            ))}
          </div>
        </TableBox>
      )}

      <TableBox
        title="Gastos recurrentes activos"
        subtitle="Próximo pago previsto, IVA deducible y retención aplicable."
      >
        {confirmed.length === 0 ? (
          <p className="text-sm text-navy/40 px-4 py-6">Sin gastos recurrentes confirmados todavía.</p>
        ) : (
          <>
            <ConfirmedRowHeader />
            <div className="divide-y divide-navy/[0.05]">
              {confirmedPageRows.map((row) => (
                <ConfirmedRow
                  key={row.expense.id}
                  row={row}
                  categories={categories}
                  contacts={contacts}
                  onOpen={() => setOpenConfirmedId(row.expense.id)}
                />
              ))}
            </div>
            <TablePagination page={confirmedPage} totalItems={confirmed.length} pageSize={PAGE_SIZE} onPageChange={setConfirmedPage} />
          </>
        )}
      </TableBox>
      </>
      )}

      {archived.length > 0 && (
        <TableBox title="Ignorados / dados de baja" subtitle="No se proyectan en la previsión de cashflow">
          <div className="divide-y divide-navy/[0.05]">
            {archived.map((row) => <ArchivedRow key={row.id} row={row} />)}
          </div>
        </TableBox>
      )}

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
          onIvaRateChange={(r) => setIvaRates((prev) => ({ ...prev, [openPendingRow.keys[0]]: r }))}
          onRetencionRateChange={(r) => setRetencionRates((prev) => ({ ...prev, [openPendingRow.keys[0]]: r }))}
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
