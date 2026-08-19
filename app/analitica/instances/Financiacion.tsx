"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Trash2, Plus } from "react-feather";
import type { Budget } from "@/lib/budgets";
import { saveBudgetsAction } from "@/app/actions/saveBudgets";
import { ChartCard } from "@/components/charts";
import ChipsInput from "@/app/components/ChipsInput";
import Field from "@/app/components/Field";

function fmtEur(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function Financiacion({
  initialBudgets,
  spent,
}: {
  initialBudgets: Budget[];
  spent: Record<string, number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>(initialBudgets);
  const [saving, setSaving] = useState(false);

  function addBudget() {
    setBudgets((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", limit: 0, contactKeyword: "", bankKeywords: [] },
    ]);
  }

  function deleteBudget(id: string) {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  function updateBudget(id: string, field: keyof Budget, value: string | number | string[]) {
    setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  }

  async function handleSave() {
    setSaving(true);
    await saveBudgetsAction(budgets);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  function handleCancel() {
    setBudgets(initialBudgets);
    setEditing(false);
  }

  return (
    <ChartCard
      title={
        <span className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="whitespace-nowrap">Amortización préstamo</span>
          <span className="text-[11px] font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded-full whitespace-nowrap self-start">
            Falta cuadro de amortización
          </span>
        </span>
      }
      headerAction={
        !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-navy/50 hover:text-navy transition-colors"
          >
            <Edit2 size={12} />
            Editar
          </button>
        )
      }
      toolbar={
        editing && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleCancel}
              className="text-xs text-navy/50 hover:text-navy px-3 py-1.5 rounded-lg border border-navy/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs text-app-bg bg-navy px-3 py-1.5 rounded-lg hover:bg-navy/85 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )
      }
    >
      {/* ── Display mode ── */}
      {!editing && (
        <>
          {budgets.length === 0 ? (
            <p className="text-sm text-navy/40 text-center py-6">
              Sin fuentes de financiación. Haz clic en{" "}
              <button onClick={() => setEditing(true)} className="text-primary underline">Editar</button>{" "}
              para añadir.
            </p>
          ) : (
            <div className="space-y-5">
              {budgets.map((b) => {
                const s = spent[b.id] ?? 0;
                const ratio = b.limit > 0 ? s / b.limit : 0;
                const exceeded = ratio > 1;
                const remaining = b.limit - s;
                const barPct = Math.min(ratio * 100, 100);
                const barColor = exceeded
                  ? "bg-danger"
                  : ratio > 0.8
                  ? "bg-warning"
                  : "bg-success";

                return (
                  <div key={b.id}>
                    <div className="mb-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-navy truncate">{b.name || "-"}</p>
                        <span className={`text-sm font-semibold tabular-nums shrink-0 ${exceeded ? "text-danger" : "text-navy/70"}`}>
                          {Math.round(ratio * 100)}%
                        </span>
                      </div>
                      <p className="text-xs text-navy/45 tabular-nums mt-0.5">
                        {fmtEur(s)} / {fmtEur(b.limit)}
                      </p>
                    </div>
                    <div className="h-2 bg-navy/[0.05] rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <p className={`text-xs ${exceeded ? "text-danger font-medium" : "text-navy/45"}`}>
                      {exceeded
                        ? `Excedido por ${fmtEur(Math.abs(remaining))}`
                        : remaining > 0
                        ? `Quedan ${fmtEur(remaining)}`
                        : "Completado"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Edit mode ── */}
      {editing && (
        <div className="space-y-3">
          {budgets.length > 0 && (
            <div className="hidden sm:grid sm:grid-cols-[1fr_130px_160px_32px] gap-2 px-1">
              <p className="text-[11px] text-navy/40 uppercase tracking-wide">Nombre</p>
              <p className="text-[11px] text-navy/40 uppercase tracking-wide">Límite (€)</p>
              <p className="text-[11px] text-navy/40 uppercase tracking-wide">Clave de contacto</p>
              <div />
            </div>
          )}

          {budgets.map((b) => (
            <div key={b.id} className="border border-navy/[0.08] rounded-[8px] p-3 space-y-2.5">
              <div className="flex flex-col sm:grid sm:grid-cols-[1fr_130px_160px_32px] gap-2 items-start sm:items-center">
                <input
                  type="text"
                  value={b.name}
                  onChange={(e) => updateBudget(b.id, "name", e.target.value)}
                  placeholder="ej: Préstamo Caixabank 40k"
                  className="w-full text-sm border border-navy/[0.12] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={b.limit || ""}
                  onChange={(e) => updateBudget(b.id, "limit", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full text-sm border border-navy/[0.12] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy tabular-nums"
                />
                <input
                  type="text"
                  value={b.contactKeyword}
                  onChange={(e) => updateBudget(b.id, "contactKeyword", e.target.value)}
                  placeholder="ej: Julia, TR, Caixabank…"
                  className="w-full text-sm border border-navy/[0.12] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
                />
                <button
                  onClick={() => deleteBudget(b.id)}
                  className="p-1.5 text-navy/25 hover:text-danger hover:bg-danger/5 rounded-lg transition-colors shrink-0"
                  aria-label="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div>
                <Field label="Palabras clave bancarias (opcional)">
                  <ChipsInput
                    values={b.bankKeywords ?? []}
                    onChange={(next) => updateBudget(b.id, "bankKeywords", next)}
                    placeholder="ej: 3019-56-00, PRES.3… (Enter para añadir)"
                    bare
                  />
                </Field>
              </div>
            </div>
          ))}

          <button
            onClick={addBudget}
            className="flex items-center gap-2 text-sm text-primary/70 hover:text-primary transition-colors mt-1 font-medium"
          >
            <Plus size={14} />
            Añadir fuente de financiación
          </button>

          {budgets.length > 0 && (
            <p className="text-[11px] text-navy/35 pt-1 leading-relaxed">
              La clave de contacto se compara con el campo Contacto de tus transacciones bancarias (no distingue mayúsculas).
              Las palabras clave bancarias se comparan directamente con el concepto y &quot;más datos&quot; del movimiento, sin pasar por
              Contactos - úsalas cuando el banco mande un concepto genérico + una referencia que Contactos ignore por parecer un código.
            </p>
          )}
        </div>
      )}
    </ChartCard>
  );
}
