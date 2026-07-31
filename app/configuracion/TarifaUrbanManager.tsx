"use client";

import { useState, useTransition } from "react";
import { Plus, Edit2, Trash2, Check, X } from "react-feather";
import type { UrbanRate } from "@/lib/urbanRates";
import { rateForDate } from "@/lib/urbanRates";
import { createUrbanRate, updateUrbanRate, deleteUrbanRate } from "./actions";

// Configuración de la tarifa pactada con Urban Sports Club (€ por clase asistida), con vigencia
// por rango de fechas. Con ella, Analítica → Ventas por > Fuente estima en vivo el € de Urban del
// mes en curso (check-ins × tarifa) antes de que llegue la transferencia del banco. Ver 028.

const inputCls =
  "w-full rounded-[5px] border border-navy/15 bg-card px-2 py-1.5 text-[13px] text-navy outline-none focus:border-primary/60";

function fmtDate(d: string | null): string {
  if (!d) return "Vigente";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

type Draft = { start_date: string; end_date: string; price_per_class: string };

function toInput(d: Draft) {
  return {
    start_date: d.start_date,
    end_date: d.end_date.trim() === "" ? null : d.end_date,
    price_per_class: Number(d.price_per_class.replace(",", ".")),
  };
}

const emptyDraft: Draft = { start_date: "", end_date: "", price_per_class: "" };

export default function TarifaUrbanManager({ rates }: { rates: UrbanRate[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const activeRate = rateForDate(rates, today);

  function startEdit(r: UrbanRate) {
    setError(null);
    setAdding(false);
    setEditingId(r.id);
    setDraft({
      start_date: r.start_date,
      end_date: r.end_date ?? "",
      price_per_class: String(r.price_per_class),
    });
  }

  function cancel() {
    setEditingId(null);
    setAdding(false);
    setDraft(emptyDraft);
    setError(null);
  }

  function save(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        cancel();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("¿Eliminar esta tarifa?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteUrbanRate(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo eliminar.");
      }
    });
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[14px] font-semibold text-navy">Tarifa Urban Sports Club</h3>
          <p className="text-[12.5px] text-muted mt-0.5">
            € que Urban paga a Aura por cada clase asistida. Momence no lo expone, así que se define aquí. Con la
            tarifa vigente se estima en vivo el € de Urban del mes en curso hasta que llega la transferencia.
          </p>
        </div>
        {!adding && editingId === null && (
          <button
            onClick={() => { setError(null); setAdding(true); setDraft({ ...emptyDraft }); }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-[5px] bg-navy px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-navy/90"
          >
            <Plus size={14} /> Añadir tarifa
          </button>
        )}
      </div>

      {activeRate != null && (
        <p className="text-[12.5px] text-muted mb-3">
          Tarifa vigente hoy: <span className="font-semibold text-navy">{activeRate.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span> / clase
        </p>
      )}

      {error && <p className="text-[12.5px] text-danger mb-3">{error}</p>}

      <div className="rounded-[6px] border border-navy/[0.08] overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2 bg-navy/[0.025] text-[11px] font-semibold uppercase tracking-wide text-navy/45">
          <span>Desde</span>
          <span>Hasta</span>
          <span className="text-right">€ / clase</span>
          <span className="w-16" />
        </div>

        {adding && (
          <RowForm
            draft={draft}
            setDraft={setDraft}
            pending={pending}
            onSave={() => save(() => createUrbanRate(toInput(draft)))}
            onCancel={cancel}
          />
        )}

        {rates.length === 0 && !adding && (
          <p className="px-3 py-5 text-[13px] text-muted text-center">Sin tarifas. Añade la primera.</p>
        )}

        {rates.map((r) =>
          editingId === r.id ? (
            <RowForm
              key={r.id}
              draft={draft}
              setDraft={setDraft}
              pending={pending}
              onSave={() => save(() => updateUrbanRate(r.id, toInput(draft)))}
              onCancel={cancel}
            />
          ) : (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2.5 items-center border-t border-navy/[0.05] text-[13px]"
            >
              <span className="text-navy">{fmtDate(r.start_date)}</span>
              <span className={r.end_date ? "text-navy" : "text-success font-medium"}>{fmtDate(r.end_date)}</span>
              <span className="text-right text-navy tabular-nums">
                {r.price_per_class.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
              <span className="flex items-center gap-1 w-16 justify-end">
                <button onClick={() => startEdit(r)} disabled={pending} className="p-1.5 rounded-[5px] text-navy/50 hover:text-navy hover:bg-navy/[0.06]" title="Editar">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => remove(r.id)} disabled={pending} className="p-1.5 rounded-[5px] text-navy/50 hover:text-danger hover:bg-danger/[0.08]" title="Eliminar">
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ),
        )}
      </div>
      <p className="text-[11.5px] text-faint mt-2">
        «Hasta» vacío = tarifa vigente indefinidamente. El rango se aplica a la fecha de cada clase, no a la del cobro.
      </p>
    </div>
  );
}

function RowForm({
  draft,
  setDraft,
  pending,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  pending: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-3 py-2.5 items-center border-t border-navy/[0.05] bg-primary/[0.03]">
      <input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} className={inputCls} />
      <input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} className={inputCls} placeholder="Vigente" />
      <input
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        value={draft.price_per_class}
        onChange={(e) => setDraft({ ...draft, price_per_class: e.target.value })}
        className={`${inputCls} text-right`}
        placeholder="11,00"
      />
      <span className="flex items-center gap-1 w-16 justify-end">
        <button onClick={onSave} disabled={pending} className="p-1.5 rounded-[5px] text-success hover:bg-success/[0.1] disabled:opacity-40" title="Guardar">
          <Check size={15} />
        </button>
        <button onClick={onCancel} disabled={pending} className="p-1.5 rounded-[5px] text-navy/50 hover:bg-navy/[0.06]" title="Cancelar">
          <X size={15} />
        </button>
      </span>
    </div>
  );
}
