"use client";
import { useState, useTransition } from "react";
import type { Category } from "@/lib/categories";
import { sortCategoriesHierarchical, categoryDisplayLabel } from "@/lib/categories";
import {
  type ContactRule, updateContactRule, deleteContactRule, applyContactRuleToExisting,
} from "@/app/transacciones/actions";

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

export default function ContactosManager({ rules: initialRules, categories }: { rules: ContactRule[]; categories: Category[] }) {
  const [rules, setRules] = useState(initialRules);
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
      <div className="px-4 py-3 border-b border-navy/[0.06]">
        <p className="text-sm font-semibold text-navy">Contactos</p>
        <p className="text-xs text-navy/45 mt-0.5">
          Reglas guardadas al importar movimientos: categoría, IVA y retención por contacto. Se aplican automáticamente en futuras importaciones.
        </p>
      </div>
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
