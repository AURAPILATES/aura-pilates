"use client";
import { useState } from "react";
import type { Category } from "@/lib/categories";
import { sortCategoriesHierarchical, categoryDisplayLabel } from "@/lib/categories";
import type { PaymentMethod } from "@/lib/transactions";
import { addCashTransaction } from "./actions";
import Drawer from "@/app/components/Drawer";
import Button, { SecondaryButton } from "@/app/components/Button";
import Select from "@/app/components/Select";
import { ToggleGroup } from "@/components/charts";

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

export default function AddCashModal({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [isIncome, setIsIncome] = useState(true);
  const [concept, setConcept] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        contact: contact || null,
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
            <label className="block text-xs text-navy/55 mb-1.5">Importe (€)</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full border border-navy/[0.12] rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:border-primary/40"
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
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="ej: a quién se le paga o de quién se cobra"
              className="w-full border border-navy/[0.12] rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:border-primary/40"
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
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
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
