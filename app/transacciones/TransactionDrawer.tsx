"use client";
import { useState } from "react";
import Drawer from "@/app/components/Drawer";
import type { Transaction } from "@/lib/transactions";
import type { Category } from "@/lib/categories";
import { CategoryPill } from "./TransaccionesList";

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

export default function TransactionDrawer({
  transaction,
  categories,
  recurringPeriod,
  onClose,
  onUpdateContact,
  onUpdateConcept,
  onUpdateCategory,
  onUpdateNotes,
  onDelete,
}: {
  transaction: Transaction;
  categories: Category[];
  recurringPeriod?: string;
  onClose: () => void;
  onUpdateContact: (id: string, value: string) => void;
  onUpdateConcept: (id: string, value: string) => void;
  onUpdateCategory: (id: string, value: string | null) => void;
  onUpdateNotes: (id: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = transaction;

  return (
    <Drawer
      title="Detalle del movimiento"
      subtitle={fmtDate(t.date)}
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
              <p className="text-xs text-navy/40 mt-0.5">Saldo tras operación: {fmtAmt(t.balance)}</p>
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

        <Field label="Contacto" value={t.contact ?? ""} onSave={(v) => onUpdateContact(t.id, v)} />
        <Field label="Concepto" value={t.concept ?? ""} onSave={(v) => onUpdateConcept(t.id, v)} />

        <div>
          <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1.5">Categoría</p>
          <CategoryPill category={t.category} categories={categories} onChange={(cat) => onUpdateCategory(t.id, cat)} />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-navy/[0.06]">
          <div>
            <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1">Fecha</p>
            <p className="text-sm text-navy">{fmtDate(t.date)}</p>
          </div>
          <div>
            <p className="text-[11px] text-navy/40 uppercase tracking-wider mb-1">Origen</p>
            <p className="text-sm text-navy">{originLabel(t.payment_method)}</p>
          </div>
        </div>

        <NotesField value={t.notes ?? ""} onSave={(v) => onUpdateNotes(t.id, v)} />
      </div>
    </Drawer>
  );
}
