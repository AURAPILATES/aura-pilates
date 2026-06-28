"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/app/components/Drawer";
import type { Transaction, PaymentMethod } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import { PERIOD_BUCKETS } from "@/lib/recurring";
import { contactKeyFor } from "@/lib/contactRules";
import type { RecurringExpense, RecurringExpenseEndType } from "@/lib/recurringExpenses";
import { CategoryPill, SourceAvatar } from "./TransaccionesList";
import ContactPicker from "./ContactPicker";
import NewContactDrawer from "./NewContactDrawer";
import { createRecurringExpenseFromTransaction, removeRecurringExpenseForTransaction, assignContactToTransaction, type Contact } from "./actions";

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo Aura" },
  { value: "victor", label: "Víctor" },
  { value: "celia", label: "Celia" },
  { value: "olga", label: "Olga" },
  { value: "carles", label: "Carles" },
];

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDate(d: string) {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function originLabel(method: string): string {
  if (method === "banco") return "CaixaBank";
  if (method === "efectivo") return "Efectivo Aura";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

function Field({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div>
      <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1">{label}</p>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) onSave(draft); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); }
        }}
        className="w-full text-sm font-medium text-navy border border-navy/[0.12] rounded-lg px-3 py-2 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition"
      />
    </div>
  );
}

/** Combobox: escribe texto libre o elige uno de los contactos guardados en
 * Configuración > Contactos. Si eliges uno guardado, vincula directamente. Si escribes un
 * nombre nuevo, abre el formulario completo de contacto (categoría, IVA, retención, conceptos
 * bancarios) prellenado con los datos de este movimiento, igual que al crear uno desde
 * Configuración > Contactos. */
function TransactionContactPicker({
  transactionId, value, contacts, categories, concept, bankDetails, category, ivaRate, retencionRate, onSaved,
}: {
  transactionId: string;
  value: string;
  contacts: Contact[];
  categories: Category[];
  concept: string | null;
  bankDetails: string | null;
  category: string | null;
  ivaRate: number | null;
  retencionRate: number | null;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [draftNewLabel, setDraftNewLabel] = useState<string | null>(null);
  const [pickerResetKey, setPickerResetKey] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function link(label: string) {
    if (label === value) return;
    setSaving(true);
    try {
      await assignContactToTransaction(transactionId, label);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  function cancelNewLabel() {
    setDraftNewLabel(null);
    setPickerResetKey((k) => k + 1);
  }

  async function remove() {
    setConfirmRemove(false);
    await link("");
    setPickerResetKey((k) => k + 1);
  }

  const derivedPattern = contactKeyFor(concept, bankDetails);

  return (
    <>
      <ContactPicker
        key={pickerResetKey}
        value={value}
        contacts={contacts}
        disabled={saving}
        commitOnBlur
        placeholder="Escribe o elige uno guardado…"
        onPick={(result) => {
          if ("contactId" in result) link(result.label);
          else if (result.newLabel.trim()) setDraftNewLabel(result.newLabel);
          else link("");
        }}
      />
      {value && (
        confirmRemove ? (
          <div className="flex items-center justify-between gap-2 mt-1.5 text-xs">
            <span className="text-navy/50">¿Quitar &ldquo;{value}&rdquo; de este movimiento?</span>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setConfirmRemove(false)} className="text-navy/45 hover:text-navy transition-colors">Cancelar</button>
              <button onClick={remove} className="font-semibold text-danger hover:text-danger/80 transition-colors">Confirmar</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            disabled={saving}
            className="mt-1.5 text-xs text-navy/40 hover:text-danger transition-colors disabled:opacity-50"
          >
            Quitar contacto
          </button>
        )
      )}
      {draftNewLabel !== null && (
        <NewContactDrawer
          categories={categories}
          initialLabel={draftNewLabel}
          initialPatterns={derivedPattern === "sin-concepto" ? [] : [derivedPattern]}
          initialCategory={category}
          initialIvaRate={ivaRate ?? 0}
          initialRetencionRate={retencionRate ?? 0}
          onCancel={cancelNewLabel}
          onCreated={(contact) => { setDraftNewLabel(null); link(contact.label); }}
        />
      )}
    </>
  );
}

const END_TYPE_OPTIONS: { value: RecurringExpenseEndType; label: string }[] = [
  { value: "never", label: "Nunca" },
  { value: "date", label: "En una fecha" },
  { value: "count", label: "Tras X repeticiones" },
];

function recurringFiscalInfo(contact: Contact | undefined): string {
  if (!contact) return "Sin contacto vinculado. Asígnalo arriba para heredar su IVA e IRPF.";
  return `Hereda de ${contact.label}: IVA ${contact.ivaRate}% · Retención ${contact.retencionRate}%`;
}

function MarkRecurringControl({
  transactionId,
  isIncome,
  contactLabel,
  contacts,
  initiallyRecurring,
  initialPeriod,
  initialEndType,
  initialEndDate,
  initialEndCount,
}: {
  transactionId: string;
  isIncome: boolean;
  contactLabel: string;
  contacts: Contact[];
  initiallyRecurring: boolean;
  initialPeriod?: string;
  initialEndType?: RecurringExpenseEndType;
  initialEndDate?: string | null;
  initialEndCount?: number | null;
}) {
  const [checked, setChecked] = useState(initiallyRecurring);
  const [period, setPeriod] = useState(initialPeriod ?? "mensual");
  const [endType, setEndType] = useState<RecurringExpenseEndType>(initialEndType ?? "never");
  const [endDate, setEndDate] = useState(initialEndDate ?? "");
  const [endCount, setEndCount] = useState(initialEndCount != null ? String(initialEndCount) : "");
  const [periodSaving, setPeriodSaving] = useState(false);
  const router = useRouter();

  const matchedContact = contacts.find((c) => c.label.toLowerCase() === contactLabel.trim().toLowerCase());
  const contactId = matchedContact?.id ?? null;

  function buildEnd(type: RecurringExpenseEndType, date: string, count: string) {
    return {
      type,
      date: type === "date" ? date || null : null,
      count: type === "count" ? parseInt(count, 10) || null : null,
    };
  }

  async function toggle(next: boolean) {
    setChecked(next);
    if (next) {
      createRecurringExpenseFromTransaction(transactionId, period, contactId, buildEnd(endType, endDate, endCount)).then(() => router.refresh());
    } else {
      await removeRecurringExpenseForTransaction(transactionId);
      router.refresh();
    }
  }

  async function save(next: { period?: string; endType?: RecurringExpenseEndType; endDate?: string; endCount?: string }) {
    const p = next.period ?? period;
    const et = next.endType ?? endType;
    const ed = next.endDate ?? endDate;
    const ec = next.endCount ?? endCount;
    setPeriodSaving(true);
    try {
      await createRecurringExpenseFromTransaction(transactionId, p, contactId, buildEnd(et, ed, ec));
      router.refresh();
    } finally {
      setPeriodSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-navy/[0.06]">
      <label className="flex items-center gap-2 text-sm font-medium text-navy cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => toggle(e.target.checked)}
          className="w-4 h-4 rounded border-navy/[0.25] accent-navy focus:ring-2 focus:ring-navy/15"
        />
        {isIncome ? "Es un ingreso recurrente" : "Es un gasto recurrente"}
      </label>
      {checked && (
        <div className="flex flex-col gap-3 pl-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1">Periodicidad</p>
              <select
                value={period}
                disabled={periodSaving}
                onChange={(e) => { setPeriod(e.target.value); save({ period: e.target.value }); }}
                className="w-full text-sm text-navy border border-navy/[0.12] rounded-lg px-2 py-1.5 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition disabled:opacity-50"
              >
                {PERIOD_BUCKETS.map((b) => (
                  <option key={b.label} value={b.label}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1">Finaliza</p>
              <select
                value={endType}
                disabled={periodSaving}
                onChange={(e) => { const v = e.target.value as RecurringExpenseEndType; setEndType(v); save({ endType: v }); }}
                className="w-full text-sm text-navy border border-navy/[0.12] rounded-lg px-2 py-1.5 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition disabled:opacity-50"
              >
                {END_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          {endType === "date" && (
            <input
              type="date"
              value={endDate}
              disabled={periodSaving}
              onChange={(e) => { setEndDate(e.target.value); save({ endDate: e.target.value }); }}
              className="w-full text-sm text-navy border border-navy/[0.12] rounded-lg px-2 py-1.5 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition disabled:opacity-50"
            />
          )}
          {endType === "count" && (
            <input
              type="number"
              min={1}
              value={endCount}
              disabled={periodSaving}
              onChange={(e) => setEndCount(e.target.value)}
              onBlur={(e) => save({ endCount: e.target.value })}
              placeholder="Número de repeticiones"
              className="w-full text-sm text-navy border border-navy/[0.12] rounded-lg px-2 py-1.5 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition disabled:opacity-50"
            />
          )}
          <p className={`text-xs rounded-lg px-3 py-2 ${matchedContact ? "bg-success/[0.08] text-success" : "bg-navy/[0.04] text-navy/45"}`}>
            {matchedContact ? "ℹ️ " : ""}{recurringFiscalInfo(matchedContact)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function TransactionDrawer({
  transaction,
  categories,
  contacts,
  recurringPeriod,
  recurringExpense,
  onClose,
  onUpdateConcept,
  onUpdateBankDetails,
  onUpdateCategory,
  onUpdateDate,
  onUpdatePaymentMethod,
  onDelete,
}: {
  transaction: Transaction;
  categories: Category[];
  contacts: Contact[];
  recurringPeriod?: string;
  recurringExpense?: RecurringExpense | null;
  onClose: () => void;
  onUpdateConcept: (id: string, value: string) => void;
  onUpdateBankDetails: (id: string, value: string) => void;
  onUpdateCategory: (id: string, value: string | null) => void;
  onUpdateDate: (id: string, value: string) => void;
  onUpdatePaymentMethod: (id: string, value: PaymentMethod) => void;
  onDelete: (id: string) => void;
}) {
  const t = transaction;
  const editableOrigin = t.payment_method !== "banco";
  const router = useRouter();

  return (
    <Drawer
      title="Detalle del movimiento"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button
            onClick={() => { onDelete(t.id); onClose(); }}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-danger border border-danger/20 rounded-lg hover:bg-danger/5 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Eliminar
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold bg-navy text-white rounded-lg hover:bg-navy/85 transition-colors"
          >
            Guardar
          </button>
        </div>
      }
    >
      <div className="px-6 py-5 flex flex-col gap-5">
        <div className="flex items-start justify-between">
          <div>
            <span className={`text-2xl font-bold tabular-nums ${t.amount > 0 ? "text-success" : "text-navy"}`}>
              {t.amount > 0 ? "+" : "−"}{fmtAmt(t.amount)}
            </span>
            {t.balance != null && (
              <p className="text-sm text-navy/40 mt-0.5">Saldo tras operación: {fmtAmt(t.balance)}</p>
            )}
          </div>
          {recurringPeriod && (
            <span className="inline-flex items-center gap-1 text-xs text-primary/60 font-medium">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
              {recurringPeriod}
            </span>
          )}
        </div>

        <Field label="Concepto" value={t.concept ?? ""} onSave={(v) => onUpdateConcept(t.id, v)} />
        <Field label="Más datos" value={t.bank_details ?? ""} onSave={(v) => onUpdateBankDetails(t.id, v)} />

        <div>
          <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1">Contacto</p>
          <TransactionContactPicker
            transactionId={t.id}
            value={t.contact ?? ""}
            contacts={contacts}
            categories={categories}
            concept={t.concept}
            bankDetails={t.bank_details}
            category={t.category}
            ivaRate={t.iva_rate}
            retencionRate={t.retencion_rate}
            onSaved={() => router.refresh()}
          />
        </div>

        <div>
          <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1.5">Categoría</p>
          <CategoryPill category={t.category} categories={categories} onChange={(cat) => onUpdateCategory(t.id, cat)} />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-navy/[0.06]">
          <div>
            <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1">Fecha</p>
            {editableOrigin ? (
              <input
                type="date"
                value={t.date}
                onChange={(e) => onUpdateDate(t.id, e.target.value)}
                className="text-sm text-navy border border-navy/[0.12] rounded-lg px-2 py-1 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition"
              />
            ) : (
              <p className="text-sm text-navy">{fmtDate(t.date)}</p>
            )}
            {t.value_date && t.value_date !== t.date && (
              <p className="text-xs text-navy/40 mt-0.5">Fecha valor: {fmtDate(t.value_date)}</p>
            )}
          </div>
          <div>
            <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1">Origen</p>
            {editableOrigin ? (
              <div className="flex items-center gap-2">
                <SourceAvatar method={t.payment_method} size={18} />
                <select
                  value={t.payment_method}
                  onChange={(e) => onUpdatePaymentMethod(t.id, e.target.value as PaymentMethod)}
                  className="text-sm text-navy border border-navy/[0.12] rounded-lg px-2 py-1 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition"
                >
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <SourceAvatar method={t.payment_method} size={18} />
                <span className="text-sm text-navy">{originLabel(t.payment_method)}</span>
              </div>
            )}
          </div>
        </div>

        <MarkRecurringControl
          transactionId={t.id}
          isIncome={t.amount > 0}
          contactLabel={t.contact ?? ""}
          contacts={contacts}
          initiallyRecurring={recurringExpense?.status === "confirmed" || !!recurringPeriod}
          initialPeriod={recurringExpense?.period ?? recurringPeriod}
          initialEndType={recurringExpense?.end_type}
          initialEndDate={recurringExpense?.end_date}
          initialEndCount={recurringExpense?.end_count}
        />
      </div>
    </Drawer>
  );
}
