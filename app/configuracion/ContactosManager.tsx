"use client";
import { useState, useTransition } from "react";
import type { Category } from "@/lib/categories";
import { sortCategoriesHierarchical, categoryDisplayLabel } from "@/lib/categories";
import { contactKeyFor } from "@/lib/contactRules";
import {
  type ContactRule, updateContactRule, deleteContactRule, applyContactRuleToExisting, createContactRule,
} from "@/app/transacciones/actions";
import Drawer from "@/app/components/Drawer";

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

function ContactRow({ rule, categories, onChange, onRemove }: {
  rule: ContactRule;
  categories: Category[];
  onChange: (patch: Partial<{ label: string; category: string | null; ivaRate: number; retencionRate: number }>) => void;
  onRemove: () => void;
}) {
  const [label, setLabel] = useState(rule.label);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);

  async function handleApply() {
    setApplying(true);
    setApplied(null);
    try {
      const { updated } = await applyContactRuleToExisting(rule.contactKey);
      setApplied(updated);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex items-center gap-2 py-2.5 px-3 border-b border-navy/[0.05] last:border-0">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => { if (label.trim() && label !== rule.label) onChange({ label: label.trim() }); }}
        className="flex-1 min-w-0 px-2 py-1 text-sm border border-navy/15 rounded-md focus:outline-none focus:border-primary/40"
      />
      <select
        value={rule.category ?? ""}
        onChange={(e) => onChange({ category: e.target.value || null })}
        className="w-40 shrink-0 px-2 py-1 text-xs border border-navy/15 rounded-md bg-white focus:outline-none focus:border-primary/40"
      >
        <option value="">Sin categoría</option>
        {sortCategoriesHierarchical(categories).map((c) => (
          <option key={c.id} value={c.value}>{categoryDisplayLabel(c, categories)}</option>
        ))}
      </select>
      <div className="flex items-center gap-1 text-xs text-navy/45 shrink-0">
        IVA <RateInput value={rule.ivaRate} onSave={(v) => onChange({ ivaRate: v })} />%
      </div>
      <div className="flex items-center gap-1 text-xs text-navy/45 shrink-0">
        Ret. <RateInput value={rule.retencionRate} onSave={(v) => onChange({ retencionRate: v })} />%
      </div>
      <button
        onClick={handleApply}
        disabled={applying}
        title="Aplicar esta regla a movimientos ya importados de este contacto"
        className="text-xs text-primary hover:text-primary/75 transition-colors shrink-0 disabled:opacity-40 whitespace-nowrap"
      >
        {applying ? "Aplicando…" : applied !== null ? `${applied} actualizados` : "Aplicar a existentes"}
      </button>
      <button onClick={onRemove} className="text-xs text-navy/35 hover:text-danger transition-colors shrink-0">
        Eliminar
      </button>
    </div>
  );
}

function NewContactForm({ categories, onCreated, onCancel }: {
  categories: Category[];
  onCreated: (rule: ContactRule) => void;
  onCancel: () => void;
}) {
  const [concept, setConcept] = useState("");
  const [contact, setContact] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [ivaRate, setIvaRate] = useState("0");
  const [retencionRate, setRetencionRate] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!label.trim()) { setError("Falta la etiqueta."); return; }
    if (!concept.trim() && !contact.trim()) { setError("Indica al menos concepto o contacto, para saber qué movimientos coinciden."); return; }
    setSaving(true);
    setError(null);
    try {
      const rule = await createContactRule({
        contactKey: contactKeyFor(concept.trim() || null, contact.trim() || null),
        label: label.trim(),
        category,
        ivaRate: parseFloat(ivaRate.replace(",", ".")) || 0,
        retencionRate: parseFloat(retencionRate.replace(",", ".")) || 0,
      });
      onCreated(rule);
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
          <label className="block text-xs font-medium text-navy/55 mb-1">Concepto</label>
          <input
            type="text" placeholder="ej. TRANSFER. EN DIV."
            value={concept} onChange={(e) => setConcept(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy/55 mb-1">Contacto / Más datos</label>
          <input
            type="text" placeholder="ej. Stripe Technology Eu"
            value={contact} onChange={(e) => setContact(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
          />
          <p className="text-xs text-navy/40 mt-1">Indica al menos concepto o contacto, para saber qué movimientos coinciden.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-navy/55 mb-1">Etiqueta</label>
          <input
            type="text" placeholder="Cómo quieres que se muestre"
            value={label} onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-navy/55 mb-1">Categoría</label>
          <select
            value={category ?? ""}
            onChange={(e) => setCategory(e.target.value || null)}
            className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg bg-white focus:outline-none focus:border-primary/40"
          >
            <option value="">Sin categoría</option>
            {sortCategoriesHierarchical(categories).map((c) => (
              <option key={c.id} value={c.value}>{categoryDisplayLabel(c, categories)}</option>
            ))}
          </select>
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

export default function ContactosManager({ rules: initialRules, categories }: { rules: ContactRule[]; categories: Category[] }) {
  const [rules, setRules] = useState(initialRules);
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();

  function patchRule(id: number, patch: Partial<{ label: string; category: string | null; ivaRate: number; retencionRate: number }>) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    startTransition(() => { updateContactRule(id, patch); });
  }

  function removeRule(id: number) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => { deleteContactRule(id); });
  }

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-navy/[0.06]">
        <div>
          <p className="text-sm font-semibold text-navy">Contactos</p>
          <p className="text-xs text-navy/45 mt-0.5">
            Reglas de categoría, IVA y retención por contacto. Se aplican automáticamente al importar movimientos que coincidan.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-3 py-1.5 text-xs font-semibold bg-navy text-white rounded-md hover:bg-navy/85 transition-colors shrink-0"
        >
          + Nuevo contacto
        </button>
      </div>
      {creating && (
        <NewContactForm
          categories={categories}
          onCancel={() => setCreating(false)}
          onCreated={(rule) => {
            setRules((prev) => [rule, ...prev.filter((r) => r.contactKey !== rule.contactKey)]);
            setCreating(false);
          }}
        />
      )}
      {rules.length === 0 ? (
        <p className="text-sm text-navy/40 px-4 py-6">Todavía no hay contactos guardados.</p>
      ) : (
        rules.map((rule) => (
          <ContactRow
            key={rule.id}
            rule={rule}
            categories={categories}
            onChange={(patch) => patchRule(rule.id, patch)}
            onRemove={() => removeRule(rule.id)}
          />
        ))
      )}
    </div>
  );
}
