"use client";
import { useState } from "react";
import type { Category } from "@/lib/categories";
import { contactKeyFor } from "@/lib/contactRules";
import { createContact, type Contact } from "./actions";
import Drawer from "@/app/components/Drawer";
import ChipsInput from "@/app/components/ChipsInput";
import Checkbox from "@/app/components/Checkbox";
import UnitInput from "@/app/components/UnitInput";
import Button, { SecondaryButton } from "@/app/components/Button";
import Field from "@/app/components/Field";
import { CategoryPill } from "./TransaccionesList";
import { CONTACT_GROUP_ORDER, CONTACT_GROUP_LABELS, type ContactGroup } from "@/lib/contactGroups";

function AutomationIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-primary/55 shrink-0">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

/** Drawer de creación de contacto con todos los campos (categoría, IVA, retención, conceptos
 * bancarios), reutilizado tanto desde Configuración > Contactos como al crear un contacto nuevo
 * desde el detalle de un movimiento - en ese caso se prellena con los datos de la transacción. */
export default function NewContactDrawer({
  categories,
  initialLabel = "",
  initialPatterns = [],
  initialCategory = null,
  initialIvaRate = 0,
  initialRetencionRate = 0,
  onCreated,
  onCancel,
}: {
  categories: Category[];
  initialLabel?: string;
  initialPatterns?: string[];
  initialCategory?: string | null;
  initialIvaRate?: number;
  initialRetencionRate?: number;
  onCreated: (contact: Contact) => void;
  onCancel: () => void;
}) {
  const [patterns, setPatterns] = useState<string[]>(initialPatterns);
  const [label, setLabel] = useState(initialLabel);
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [ivaRate, setIvaRate] = useState(String(initialIvaRate));
  const [retencionRate, setRetencionRate] = useState(String(initialRetencionRate));
  const [group, setGroup] = useState<ContactGroup>("proveedor");
  const [noTax, setNoTax] = useState(false);
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
        noTax,
        group,
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
      footer={(close) => (
        <div className="flex gap-2">
          <SecondaryButton onClick={close} className="flex-1">
            Cancelar
          </SecondaryButton>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      )}
    >
      <div className="px-6 py-5 space-y-[12px]">
        <Field label="Nombre">
          <input
            type="text" placeholder="Cómo quieres que se muestre"
            value={label} onChange={(e) => setLabel(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-navy/30"
          />
        </Field>
        <div className="p-3.5 bg-primary/[0.06] border border-primary/15 rounded-xl">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-primary/80 mb-1.5">
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
        <Field label={<>Categoría <span className="font-normal text-navy/35">(opcional)</span></>}>
          <CategoryPill category={category} categories={categories} onChange={setCategory} />
        </Field>
        <div>
          <label className="block text-xs font-medium text-navy/55 mb-1.5">Grupo</label>
          <div className="grid grid-cols-3 gap-2">
            {CONTACT_GROUP_ORDER.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={`text-[13px] px-2 py-2 rounded-lg border transition-colors ${
                  group === g
                    ? "border-navy bg-navy/[0.06] text-navy font-semibold"
                    : "border-navy/[0.10] text-navy/50 hover:border-navy/20"
                }`}
              >
                {CONTACT_GROUP_LABELS[g]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="IVA">
            <UnitInput unit="%" value={ivaRate} onChange={(e) => setIvaRate(e.target.value)} bare />
          </Field>
          <Field label="Retención">
            <UnitInput unit="%" value={retencionRate} onChange={(e) => setRetencionRate(e.target.value)} bare />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-navy/55 cursor-pointer">
          <Checkbox checked={noTax} onChange={(e) => setNoTax(e.target.checked)} tone="primary" />
          Sin IVA ni retenciones
        </label>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Drawer>
  );
}

export { AutomationIcon };
