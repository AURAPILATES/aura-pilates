"use client";
import { useState } from "react";
import type { Category } from "@/lib/categories";
import { contactKeyFor } from "@/lib/contactRules";
import { createContact, type Contact } from "./actions";
import Drawer from "@/app/components/Drawer";
import ChipsInput from "@/app/components/ChipsInput";
import { CategoryPill } from "./TransaccionesList";

function AutomationIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-primary/55 shrink-0">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

/** Drawer de creación de contacto con todos los campos (categoría, IVA, retención, conceptos
 * bancarios), reutilizado tanto desde Configuración > Contactos como al crear un contacto nuevo
 * desde el detalle de un movimiento — en ese caso se prellena con los datos de la transacción. */
export default function NewContactDrawer({
  categories,
  initialLabel = "",
  initialPatterns = [],
  initialCategory = null,
  onCreated,
  onCancel,
}: {
  categories: Category[];
  initialLabel?: string;
  initialPatterns?: string[];
  initialCategory?: string | null;
  onCreated: (contact: Contact) => void;
  onCancel: () => void;
}) {
  const [patterns, setPatterns] = useState<string[]>(initialPatterns);
  const [label, setLabel] = useState(initialLabel);
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [ivaRate, setIvaRate] = useState("0");
  const [retencionRate, setRetencionRate] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          <label className="block text-xs font-medium text-navy/55 mb-1">Nombre</label>
          <input
            type="text" placeholder="Cómo quieres que se muestre"
            value={label} onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-navy/15 rounded-lg focus:outline-none focus:border-primary/40"
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-navy/55 mb-1.5">
            <AutomationIcon />
            Conceptos bancarios
          </label>
          <ChipsInput
            values={patterns}
            onChange={setPatterns}
            clean={(raw) => contactKeyFor(raw, null)}
            placeholder="ej. Spotify, Stripe Technology Eu… (Enter para añadir)"
          />
          <p className="text-xs text-navy/40 mt-1.5">Texto tal y como aparece en el extracto del banco (concepto o contacto). Puedes añadir varios.</p>
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

export { AutomationIcon };
