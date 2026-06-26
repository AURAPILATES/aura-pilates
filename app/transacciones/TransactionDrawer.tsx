"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Drawer from "@/app/components/Drawer";
import type { Transaction, PaymentMethod } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import { PERIOD_BUCKETS } from "@/lib/recurring";
import { CategoryPill, SourceAvatar } from "./TransaccionesList";
import { createRecurringExpenseFromTransaction, type ContactRule } from "./actions";

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
 * Configuración > Contactos, para no tener que retipear nombres ya conocidos
 * (y evitar typos que rompan el agrupado por contacto de los gastos recurrentes). */
function ContactPicker({ value, contactRules, onSave }: { value: string; contactRules: ContactRule[]; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    const labels = [...new Set(contactRules.map((r) => r.label))].sort((a, b) => a.localeCompare(b));
    const q = draft.trim().toLowerCase();
    return q ? labels.filter((l) => l.toLowerCase().includes(q)) : labels;
  }, [contactRules, draft]);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) {
        setOpen(false);
        if (draft !== value) onSave(draft);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, draft, value, onSave]);

  function openDropdown() {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(true);
  }

  function pick(label: string) {
    setDraft(label);
    onSave(label);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); if (!open) openDropdown(); }}
        onFocus={openDropdown}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(draft); setOpen(false); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") { setDraft(value); setOpen(false); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder="Escribe o elige uno guardado…"
        className="w-full text-sm font-medium text-navy border border-navy/[0.12] rounded-lg px-3 py-2 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition"
      />
      {open && dropPos && options.length > 0 && createPortal(
        <div
          ref={dropRef}
          className="fixed z-[9999] bg-white border border-navy/10 rounded-xl shadow-xl overflow-y-auto py-1"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, maxHeight: "14rem" }}
        >
          {options.map((label) => (
            <button
              key={label}
              onClick={() => pick(label)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-navy/[0.04] transition-colors ${label === value ? "font-semibold text-navy" : "text-navy/70"}`}
            >
              {label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

function NotesField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div>
      <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1">Notas</p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) onSave(draft); }}
        placeholder="Añade una nota…"
        rows={3}
        className="w-full text-sm text-navy border border-navy/[0.12] rounded-lg px-3 py-2 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition resize-none"
      />
    </div>
  );
}

function MarkRecurringControl({ transactionId }: { transactionId: string }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState("mensual");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function confirm() {
    setSaving(true);
    try {
      await createRecurringExpenseFromTransaction(transactionId, period, 21, 0);
      setDone(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return <p className="text-xs text-primary/70">Dado de alta como gasto recurrente {period}. Ajusta IVA/retención en Gastos recurrentes.</p>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-primary/70 hover:text-primary transition-colors self-start"
      >
        + Marcar como gasto recurrente
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-xs text-navy/45">Periodicidad</label>
      <select
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        className="text-sm border border-navy/[0.12] rounded-lg px-2 py-1.5 outline-none focus:border-primary/50"
      >
        {PERIOD_BUCKETS.map((b) => (
          <option key={b.label} value={b.label}>{b.label}</option>
        ))}
      </select>
      <button
        onClick={confirm}
        disabled={saving}
        className="px-3 py-1.5 text-xs font-semibold text-white bg-navy rounded-lg hover:bg-navy/85 transition-colors disabled:opacity-40"
      >
        Confirmar
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-navy/45 hover:text-navy transition-colors">
        Cancelar
      </button>
    </div>
  );
}

export default function TransactionDrawer({
  transaction,
  categories,
  contactRules,
  recurringPeriod,
  onClose,
  onUpdateContact,
  onUpdateConcept,
  onUpdateCategory,
  onUpdateNotes,
  onUpdateDate,
  onUpdatePaymentMethod,
  onDelete,
}: {
  transaction: Transaction;
  categories: Category[];
  contactRules: ContactRule[];
  recurringPeriod?: string;
  onClose: () => void;
  onUpdateContact: (id: string, value: string) => void;
  onUpdateConcept: (id: string, value: string) => void;
  onUpdateCategory: (id: string, value: string | null) => void;
  onUpdateNotes: (id: string, value: string) => void;
  onUpdateDate: (id: string, value: string) => void;
  onUpdatePaymentMethod: (id: string, value: PaymentMethod) => void;
  onDelete: (id: string) => void;
}) {
  const t = transaction;
  const editableOrigin = t.payment_method !== "banco";

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

        <div>
          <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1">Contacto</p>
          <ContactPicker value={t.contact ?? ""} contactRules={contactRules} onSave={(v) => onUpdateContact(t.id, v)} />
        </div>
        <Field label="Concepto" value={t.concept ?? ""} onSave={(v) => onUpdateConcept(t.id, v)} />

        <div>
          <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1.5">Categoría</p>
          <CategoryPill category={t.category} categories={categories} onChange={(cat) => onUpdateCategory(t.id, cat)} />
        </div>

        {t.amount < 0 && !recurringPeriod && <MarkRecurringControl transactionId={t.id} />}

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

        <NotesField value={t.notes ?? ""} onSave={(v) => onUpdateNotes(t.id, v)} />
      </div>
    </Drawer>
  );
}
