"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Budget } from "@/lib/budgets";
import { saveBudgetsAction } from "@/app/actions/saveBudgets";

function fmtEur(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export default function PresupuestosBlock({
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
      { id: crypto.randomUUID(), name: "", limit: 0, contactKeyword: "" },
    ]);
  }

  function deleteBudget(id: string) {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  function updateBudget(id: string, field: keyof Budget, value: string | number) {
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
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs font-semibold text-navy/55 uppercase tracking-wider">Financiación</p>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-navy/40 hover:text-navy/70 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="text-xs text-navy/50 hover:text-navy px-3 py-1.5 rounded-lg border border-navy/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        )}
      </div>

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
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-navy">{b.name || "—"}</p>
                      <div className="flex items-baseline gap-3">
                        <span className="text-xs text-navy/45 tabular-nums">
                          {fmtEur(s)} / {fmtEur(b.limit)}
                        </span>
                        <span className={`text-sm font-semibold tabular-nums w-14 text-right ${exceeded ? "text-danger" : "text-navy/70"}`}>
                          {Math.round(ratio * 100)}%
                        </span>
                      </div>
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
            <div key={b.id} className="flex flex-col sm:grid sm:grid-cols-[1fr_130px_160px_32px] gap-2 items-start sm:items-center">
              <input
                type="text"
                value={b.name}
                onChange={(e) => updateBudget(b.id, "name", e.target.value)}
                placeholder="Nombre (ej: Papas <> Julia)"
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
                className="p-1.5 text-navy/25 hover:text-danger hover:bg-danger/5 rounded-lg transition-colors"
                aria-label="Eliminar"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          ))}

          <button
            onClick={addBudget}
            className="flex items-center gap-2 text-sm text-primary/70 hover:text-primary transition-colors mt-1 font-medium"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Añadir fuente de financiación
          </button>

          {budgets.length > 0 && (
            <p className="text-[11px] text-navy/35 pt-1 leading-relaxed">
              La clave de contacto se compara con el campo Contacto de tus transacciones bancarias (no distingue mayúsculas).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
