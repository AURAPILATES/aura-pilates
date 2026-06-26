"use client";
import { useState, useTransition } from "react";
import type { Category } from "@/lib/categories";
import { contactKeyFor } from "@/lib/contactRules";
import {
  type Contact, updateContact, deleteContact, applyContactToExisting, createContact,
  addPatternToContact, removeContactPattern, recomputeContactsFromBankDetails,
} from "@/app/transacciones/actions";
import Drawer from "@/app/components/Drawer";
import { CategoryPill } from "@/app/transacciones/TransaccionesList";

function RateInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = parseFloat(draft.replace(",", ".")) || 0;
        setDraft(String(v));
        if (v !== value) onSave(v);
      }}
      className="w-14 px-1.5 py-1 text-xs text-right border border-navy/15 rounded-md focus:outline-none focus:border-primary/40"
    />
  );
}

/** Lista de patrones (conceptos bancarios) que identifican a un contacto, con chips
 * removibles y un input para añadir uno más — p. ej. cuando una empresa factura con un
 * texto distinto al habitual ("Spotify P4106A003" además de "SPOTIFY SPAIN SL"). */
function PatternsEditor({ contactId, patterns, onAdd, onRemove }: {
  contactId: number;
  patterns: string[];
  onAdd: (pattern: string) => void;
  onRemove: (pattern: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!draft.trim()) return;
    const pattern = contactKeyFor(draft.trim(), null);
    if (patterns.includes(pattern)) { setDraft(""); return; }
    setAdding(true);
    try {
      await addPatternToContact(contactId, pattern);
      onAdd(pattern);
      setDraft("");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(pattern: string) {
    await removeContactPattern(pattern);
    onRemove(pattern);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {patterns.map((p) => (
        <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy/[0.04] rounded-full text-[11px] text-navy/55">
          {p}
          <button onClick={() => handleRemove(p)} className="text-navy/30 hover:text-danger transition-colors">✕</button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
        onBlur={handleAdd}
        placeholder="+ añadir concepto…"
        disabled={adding}
        className="w-32 px-1.5 py-0.5 text-[11px] border border-navy/15 rounded-full focus:outline-none focus:border-primary/40 disabled:opacity-50"
      />
    </div>
  );
}

function ContactRow({ contact, categories, onChange, onRemove }: {
  contact: Contact;
  categories: Category[];
  onChange: (patch: Partial<{ label: string; category: string | null; ivaRate: number; retencionRate: number; patterns: string[] }>) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(contact.label);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);

  async function handleApply() {
    setApplying(true);
    setApplied(null);
    try {
      const { updated } = await applyContactToExisting(contact.id);
      setApplied(updated);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="py-2.5 px-3 border-b border-navy/[0.05] last:border-0">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => { if (label.trim() && label !== contact.label) onChange({ label: label.trim() }); }}
          className="flex-1 min-w-0 px-2 py-1 text-sm border border-navy/15 rounded-md focus:outline-none focus:border-primary/40"
        />
        <div className="shrink-0">
          <CategoryPill category={contact.category} categories={categories} onChange={(cat) => onChange({ category: cat })} />
        </div>
        <div className="flex items-center gap-1 text-xs text-navy/45 shrink-0">
          IVA <RateInput value={contact.ivaRate} onSave={(v) => onChange({ ivaRate: v })} />%
        </div>
        <div className="flex items-center gap-1 text-xs text-navy/45 shrink-0">
          Ret. <RateInput value={contact.retencionRate} onSave={(v) => onChange({ retencionRate: v })} />%
        </div>
        <button
          onClick={handleApply}
          disabled={applying}
          title="Aplicar este contacto a movimientos ya importados que coincidan con sus conceptos"
          className="text-xs text-primary hover:text-primary/75 transition-colors shrink-0 disabled:opacity-40 whitespace-nowrap"
        >
          {applying ? "Aplicando…" : applied !== null ? `${applied} actualizados` : "Aplicar a existentes"}
        </button>
        <button onClick={onRemove} className="text-xs text-navy/35 hover:text-danger transition-colors shrink-0">
          Eliminar
        </button>
      </div>
      <PatternsEditor
        contactId={contact.id}
        patterns={contact.patterns}
        onAdd={(p) => onChange({ patterns: [...contact.patterns, p] })}
        onRemove={(p) => onChange({ patterns: contact.patterns.filter((x) => x !== p) })}
      />
    </div>
  );
}

function NewContactForm({ categories, onCreated, onCancel }: {
  categories: Category[];
  onCreated: (contact: Contact) => void;
  onCancel: () => void;
}) {
  const [patternDraft, setPatternDraft] = useState("");
  const [patterns, setPatterns] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [ivaRate, setIvaRate] = useState("0");
  const [retencionRate, setRetencionRate] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addPattern() {
    const key = contactKeyFor(patternDraft.trim(), null);
    if (patternDraft.trim() && !patterns.includes(key)) setPatterns((prev) => [...prev, key]);
    setPatternDraft("");
  }

  async function handleSave() {
    if (!label.trim()) { setError("Falta la etiqueta."); return; }
    if (patterns.length === 0) { setError("Añade al menos un concepto para saber qué movimientos coinciden."); return; }
    setSaving(true);
    setError(null);
    try {
      const contact = await createContact({
        label: label.trim(),
        category,
        ivaRate: parseFloat(ivaRate.replace(",", ".")) || 0,
        retencionRate: parseFloat(retencionRate.replace(",", ".")) || 0,
        patterns,
      });
      onCreated(contact);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      title="Nuevo contacto"
      subtitle="Categoría, IVA y retención reutilizables para futuras importaciones"
      onClose={onCancel}
      footer={
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm text-navy/60 border border-navy/15 rounded-lg hover:bg-navy/[0.03] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-semibold bg-navy text-white rounded-lg hover:bg-navy/85 transition-colors disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar contacto"}
          </button>
        </div>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-navy/55 mb-1">Etiqueta</label>
          <input
            type="text" placeholder="Cómo quieres que se muestre"
            value={label} onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy/55 mb-1">Conceptos para etiquetarlo</label>
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {patterns.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 bg-navy/[0.04] rounded-full text-[11px] text-navy/55">
                {p}
                <button onClick={() => setPatterns((prev) => prev.filter((x) => x !== p))} className="text-navy/30 hover:text-danger transition-colors">✕</button>
              </span>
            ))}
          </div>
          <input
            type="text" placeholder="ej. Spotify, Stripe Technology Eu… (Enter para añadir)"
            value={patternDraft} onChange={(e) => setPatternDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPattern(); } }}
            onBlur={addPattern}
            className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
          />
          <p className="text-xs text-navy/40 mt-1">Texto tal y como aparece en el extracto del banco (concepto o contacto). Puedes añadir varios.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy/55 mb-1">Categoría</label>
          <CategoryPill category={category} categories={categories} onChange={setCategory} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-navy/55 mb-1">IVA %</label>
            <input
              type="text" inputMode="decimal" value={ivaRate} onChange={(e) => setIvaRate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-navy/55 mb-1">Retención %</label>
            <input
              type="text" inputMode="decimal" value={retencionRate} onChange={(e) => setRetencionRate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
            />
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Drawer>
  );
}

export default function ContactosManager({ contacts: initialContacts, categories }: { contacts: Contact[]; categories: Category[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [creating, setCreating] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputed, setRecomputed] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  async function handleRecompute() {
    setRecomputing(true);
    setRecomputed(null);
    try {
      const { updated } = await recomputeContactsFromBankDetails();
      setRecomputed(updated);
    } finally {
      setRecomputing(false);
    }
  }

  function patchContact(id: number, patch: Partial<{ label: string; category: string | null; ivaRate: number; retencionRate: number; patterns: string[] }>) {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const rest: { label?: string; category?: string | null; ivaRate?: number; retencionRate?: number } = {};
    if (patch.label !== undefined) rest.label = patch.label;
    if (patch.category !== undefined) rest.category = patch.category;
    if (patch.ivaRate !== undefined) rest.ivaRate = patch.ivaRate;
    if (patch.retencionRate !== undefined) rest.retencionRate = patch.retencionRate;
    if (Object.keys(rest).length) startTransition(() => { updateContact(id, rest); });
  }

  function removeContact(id: number) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    startTransition(() => { deleteContact(id); });
  }

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-navy/[0.06]">
        <div>
          <p className="text-sm font-semibold text-navy">Contactos</p>
          <p className="text-xs text-navy/45 mt-0.5">
            Categoría, IVA y retención por contacto, identificado por uno o varios conceptos bancarios. Se aplican automáticamente al importar movimientos que coincidan.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            title="Vuelve a calcular Contacto a partir de Concepto + Más datos, cruzando con los contactos guardados"
            className="text-xs text-navy/45 hover:text-navy transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {recomputing ? "Recalculando…" : recomputed !== null ? `${recomputed} movimientos actualizados` : "Recalcular contactos"}
          </button>
          <button
            onClick={() => setCreating(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-navy text-white rounded-md hover:bg-navy/85 transition-colors"
          >
            + Nuevo contacto
          </button>
        </div>
      </div>
      {creating && (
        <NewContactForm
          categories={categories}
          onCancel={() => setCreating(false)}
          onCreated={(contact) => {
            setContacts((prev) => [contact, ...prev]);
            setCreating(false);
          }}
        />
      )}
      {contacts.length === 0 ? (
        <p className="text-sm text-navy/40 px-4 py-6">Todavía no hay contactos guardados.</p>
      ) : (
        contacts.map((contact) => (
          <ContactRow
            key={contact.id}
            contact={contact}
            categories={categories}
            onChange={(patch) => patchContact(contact.id, patch)}
            onRemove={() => removeContact(contact.id)}
          />
        ))
      )}
    </div>
  );
}
