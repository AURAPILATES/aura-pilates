"use client";
import { useEffect, useRef, useState } from "react";
import type { Category } from "@/lib/categories";
import type { PaymentMethod } from "@/lib/transactions";
import { matchesPattern } from "@/lib/contactRules";
import { todayLocalISO } from "@/lib/dateRange";
import { addCashTransaction, findCashDuplicates, type Contact, type CashDuplicateCandidate } from "./actions";
import Drawer from "@/app/components/Drawer";
import Button, { SecondaryButton } from "@/app/components/Button";
import Select from "@/app/components/Select";
import UnitInput from "@/app/components/UnitInput";
import Field from "@/app/components/Field";
import { ToggleGroup } from "@/components/charts";
import ContactPicker from "./ContactPicker";
import { CategoryPill } from "./TransaccionesList";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo Aura" },
  { value: "victor", label: "Víctor" },
  { value: "celia", label: "Celia" },
  { value: "olga", label: "Olga" },
  { value: "carles", label: "Carles" },
];

function todayISO() {
  return todayLocalISO();
}

function fmtDateShort(d: string): string {
  return d.split("-").reverse().join("/");
}

function fmtAmtShort(n: number): string {
  return Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
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
  // Movimientos ya guardados que podrían ser este mismo pago (ver findCashDuplicates) - si hay
  // alguno, se pide confirmar antes de guardar en vez de descartar solo como hace la importación
  // bancaria (aquí no hay archivo con el que comparar, el usuario solo lo escribe una vez).
  const [duplicates, setDuplicates] = useState<CashDuplicateCandidate[] | null>(null);

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

  async function handleSave(close: () => void, force = false) {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const amount = isIncome ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);
      if (!force) {
        const found = await findCashDuplicates({ date, amount, concept });
        if (found.length > 0) {
          setDuplicates(found);
          setSaving(false);
          return;
        }
      }
      await addCashTransaction({
        date,
        amount,
        concept,
        category: category || null,
        contactId,
        newContactLabel: contactId == null ? contactLabel || null : null,
        notes,
        paymentMethod,
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
      setSaving(false);
    }
  }

  // Cualquier cambio tras ver el aviso de duplicados lo invalida - hay que volver a comprobar
  // antes de guardar en vez de dejar "Guardar de todas formas" apuntando a datos ya editados.
  function clearDuplicatesOnEdit() {
    if (duplicates) setDuplicates(null);
  }

  return (
    <Drawer
      title="Añadir movimiento manual"
      onClose={onClose}
      footer={(close) =>
        duplicates && duplicates.length > 0 ? (
          <div className="w-full">
            <p className="text-xs text-warning bg-warning/[0.08] rounded-lg px-3 py-2 mb-3">
              Ya hay {duplicates.length === 1 ? "un movimiento parecido" : `${duplicates.length} movimientos parecidos`} el {fmtDateShort(duplicates[0].date)}:{" "}
              {duplicates.map((d) => `${d.label} (${d.amount > 0 ? "+" : "−"}${fmtAmtShort(d.amount)})`).join(", ")}. ¿Seguro que quieres añadir este también?
            </p>
            <div className="flex gap-3">
              <SecondaryButton onClick={() => setDuplicates(null)} disabled={saving}>
                Revisar
              </SecondaryButton>
              <Button onClick={() => handleSave(close, true)} disabled={saving} className="flex-1">
                {saving ? "Guardando…" : "Guardar de todas formas"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <SecondaryButton onClick={close} disabled={saving} className="flex-1">
              Cancelar
            </SecondaryButton>
            <Button onClick={() => handleSave(close)} disabled={!canSave || saving} className="flex-1">
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        )
      }
    >
        <div className="px-6 py-5 space-y-[14px]">
          <ToggleGroup
            options={[
              { value: "income", label: "Ingreso", activeClassName: "bg-success text-white font-medium" },
              { value: "expense", label: "Gasto", activeClassName: "bg-danger text-white font-medium" },
            ]}
            value={isIncome ? "income" : "expense"}
            onChange={(v) => { setIsIncome(v === "income"); clearDuplicatesOnEdit(); }}
            fullWidth
            className="[&_button]:py-2 [&_button]:text-[13px]"
          />

          <Field label="Fecha">
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); clearDuplicatesOnEdit(); }}
              className="w-full bg-transparent outline-none"
            />
          </Field>

          <Field label="Importe">
            <UnitInput
              unit="€"
              unitSide="left"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); clearDuplicatesOnEdit(); }}
              placeholder="0,00"
              bare
            />
          </Field>

          <Field label="Concepto">
            <input
              type="text"
              value={concept}
              onChange={(e) => { setConcept(e.target.value); clearDuplicatesOnEdit(); }}
              placeholder="ej: pago salario"
              className="w-full bg-transparent outline-none placeholder:text-navy/30"
            />
          </Field>

          <Field label={<>Contacto <span className="font-normal text-navy/35">(opcional)</span></>}>
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
              bare
            />
          </Field>

          <Field label="Descripción" align="start">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales…"
              rows={2}
              className="w-full bg-transparent outline-none resize-none placeholder:text-navy/30"
            />
          </Field>

          <Field label="Categoría">
            <CategoryPill
              category={category || null}
              categories={categories}
              onChange={(cat) => { categoryTouched.current = true; setCategory(cat || ""); }}
            />
          </Field>

          <Field label="Origen del pago">
            <Select variant="bare" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </Field>

          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
    </Drawer>
  );
}
