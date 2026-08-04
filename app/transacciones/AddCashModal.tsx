"use client";
import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/categories";
import { sortCategoriesHierarchical, categoryDisplayLabel } from "@/lib/categories";
import type { PaymentMethod } from "@/lib/transactions";
import { matchesPattern } from "@/lib/contactRules";
import { addCashTransaction, type Contact } from "./actions";
import Drawer from "@/app/components/Drawer";
import Button, { SecondaryButton } from "@/app/components/Button";
import Select from "@/app/components/Select";
import UnitInput from "@/app/components/UnitInput";
import { ToggleGroup } from "@/components/charts";
import ContactPicker from "./ContactPicker";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo Aura" },
  { value: "victor", label: "Víctor" },
  { value: "celia", label: "Celia" },
  { value: "olga", label: "Olga" },
  { value: "carles", label: "Carles" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Busca, entre los conceptos bancarios guardados de cada contacto (y si no tiene ninguno, su
 * nombre), el que aparece dentro del concepto tecleado - para sugerir el contacto sin que el
 * texto tenga que coincidir exactamente (ej. "Nómina efectivo agosto Zuzi" reconoce el alias
 * "Zuzi" guardado en Zuzana Rakaiova). Si varios contactos coinciden, gana el patrón más largo
 * (más específico). */
function suggestContactForConcept(concept: string, contacts: Contact[]): Contact | null {
  const text = concept.trim();
  if (!text) return null;
  let best: Contact | null = null;
  let bestLength = 0;
  for (const c of contacts) {
    const candidates = c.patterns.length ? c.patterns : [c.label];
    for (const pattern of candidates) {
      if (pattern.length > bestLength && matchesPattern(text, pattern)) {
        best = c;
        bestLength = pattern.length;
      }
    }
  }
  return best;
}

export default function AddCashModal({ categories, contacts, onClose }: { categories: Category[]; contacts: Contact[]; onClose: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [isIncome, setIsIncome] = useState(true);
  const [concept, setConcept] = useState("");
  const [contactLabel, setContactLabel] = useState("");
  const [contactId, setContactId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactTouched = useRef(false);
  const categoryTouched = useRef(false);

  useEffect(() => {
    if (contactTouched.current) return;
    const match = suggestContactForConcept(concept, contacts);
    setContactLabel(match?.label ?? "");
    setContactId(match?.id ?? null);
    if (match?.category && !categoryTouched.current) setCategory(match.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept, contacts]);

  const parsedAmount = parseFloat(amount.replace(",", "."));
  const canSave = !isNaN(parsedAmount) && parsedAmount > 0 && date.length === 10;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await addCashTransaction({
        date,
        amount: isIncome ? Math.abs(parsedAmount) : -Math.abs(parsedAmount),
        concept,
        category: category || null,
        contactId,
        newContactLabel: contactId == null ? contactLabel || null : null,
        notes,
        paymentMethod,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
      setSaving(false);
    }
  }

  return (
    <Drawer
      title="Añadir movimiento manual"
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <SecondaryButton onClick={onClose} disabled={saving} className="flex-1">
            Cancelar
          </SecondaryButton>
          <Button onClick={handleSave} disabled={!canSave || saving} className="flex-1">
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      }
    >
        <div className="px-6 py-5 space-y-4">
          <ToggleGroup
            options={[
              { value: "income", label: "Ingreso", activeClassName: "bg-success text-white font-medium" },
              { value: "expense", label: "Gasto", activeClassName: "bg-danger text-white font-medium" },
            ]}
            value={isIncome ? "income" : "expense"}
            onChange={(v) => setIsIncome(v === "income")}
            fullWidth
            className="[&_button]:py-[3px] [&_button]:text-[13px]"
          />

          <div>
            <label className="block text-xs text-navy/55 mb-1.5">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-navy/[0.12] rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:border-primary/40"
            />
          </div>

          <div>
            <label className="block text-xs text-navy/55 mb-1.5">Importe</label>
            <UnitInput
              unit="€"
              unitSide="left"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div>
            <label className="block text-xs text-navy/55 mb-1.5">Concepto</label>
            <input
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="ej: pago salario"
              className="w-full border border-navy/[0.12] rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:border-primary/40"
            />
          </div>

          <div>
            <label className="block text-xs text-navy/55 mb-1.5">
              Contacto <span className="text-navy/35">(opcional)</span>
            </label>
            <ContactPicker
              value={contactLabel}
              contacts={contacts}
              placeholder="Buscar contacto o crear…"
              onPick={(result) => {
                contactTouched.current = true;
                if ("contactId" in result) {
                  setContactLabel(result.label);
                  setContactId(result.contactId);
                  const picked = contacts.find((c) => c.id === result.contactId);
                  if (picked?.category) setCategory(picked.category);
                } else {
                  setContactLabel(result.newLabel);
                  setContactId(null);
                }
              }}
            />
          </div>

          <div>
            <label className="block text-xs text-navy/55 mb-1.5">Descripción</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales…"
              rows={2}
              className="w-full border border-navy/[0.12] rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:border-primary/40 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-navy/55 mb-1.5">Categoría</label>
            <Select value={category} onChange={(e) => { categoryTouched.current = true; setCategory(e.target.value); }}>
              <option value="">Sin categoría</option>
              {sortCategoriesHierarchical(categories).map((c) => (
                <option key={c.value} value={c.value}>{categoryDisplayLabel(c, categories)}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs text-navy/55 mb-1.5">Origen del pago</label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
    </Drawer>
  );
}
