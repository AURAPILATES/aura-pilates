"use client";
import { useState } from "react";
import type { Category } from "@/lib/categories";
import { sortCategoriesHierarchical, categoryDisplayLabel } from "@/lib/categories";
import type { PaymentMethod } from "@/lib/transactions";
import { addCashTransaction } from "./actions";
import Drawer from "@/app/components/Drawer";

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
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="w-full py-2.5 text-sm font-semibold bg-navy text-white rounded-lg hover:bg-navy/85 transition-colors disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Guardar movimiento"}
        </button>
      }
    >
        <div className="px-6 py-5 space-y-4">
          <div className="flex border border-navy/[0.12] rounded-lg bg-white p-0.5 text-sm">
            <button
              onClick={() => setIsIncome(true)}
              className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${isIncome ? "bg-success text-white" : "text-navy/50 hover:text-navy"}`}
            >
              Ingreso
            </button>
            <button
              onClick={() => setIsIncome(false)}
              className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${!isIncome ? "bg-danger text-white" : "text-navy/50 hover:text-navy"}`}
            >
              Gasto
            </button>
          </div>

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
              placeholder="ej: clase suelta pagada en caja"
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
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-navy/[0.12] rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:border-primary/40 bg-white"
            >
              <option value="">Sin categoría</option>
              {sortCategoriesHierarchical(categories).map((c) => (
                <option key={c.value} value={c.value}>{categoryDisplayLabel(c, categories)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-navy/55 mb-1.5">Origen del pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full border border-navy/[0.12] rounded-lg px-3 py-2 text-sm text-navy focus:outline-none focus:border-primary/40 bg-white"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
    </Drawer>
  );
}
