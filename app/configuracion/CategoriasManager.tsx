"use client";
import { useState, useTransition } from "react";
import type { Category, GroupType } from "@/lib/categories";
import { createCategory, updateCategory, deleteCategory } from "./actions";

const GROUP_LABELS: Record<GroupType, string> = {
  operational: "Operacional",
  income: "Ingresos",
  transfer: "Financiación",
};

const GROUP_ORDER: GroupType[] = ["income", "operational", "transfer"];

const KNOWN_GROUPS = new Set<string>(["income", "transfer", "operational"]);

const EMPTY: Omit<Category, "id" | "created_at"> = {
  value: "",
  label: "",
  emoji: "📦",
  bg_color: "#F8FAFC",
  text_color: "#94A3B8",
  group_type: "operational",
  auto_keywords: null,
  sort_order: 99,
};

type EditorState = { mode: "new" } | { mode: "edit"; cat: Category };

export default function CategoriasManager({ categories }: { categories: Category[] }) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [form, setForm] = useState<Omit<Category, "id" | "created_at">>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openNew() {
    setForm({ ...EMPTY, sort_order: categories.length + 1 });
    setEditor({ mode: "new" });
    setError(null);
  }

  function openEdit(cat: Category) {
    setForm({
      value: cat.value,
      label: cat.label,
      emoji: cat.emoji,
      bg_color: cat.bg_color,
      text_color: cat.text_color,
      group_type: KNOWN_GROUPS.has(cat.group_type) ? cat.group_type as GroupType : "operational",
      auto_keywords: cat.auto_keywords,
      sort_order: cat.sort_order,
    });
    setEditor({ mode: "edit", cat });
    setError(null);
  }

  function closeEditor() {
    setEditor(null);
    setError(null);
  }

  function handleSave() {
    if (!form.value.trim() || !form.label.trim()) {
      setError("El identificador y el nombre son obligatorios.");
      return;
    }
    startTransition(async () => {
      try {
        if (editor?.mode === "edit") {
          await updateCategory(editor.cat.id, {
            ...form,
            auto_keywords: form.auto_keywords?.trim() || null,
          });
        } else {
          await createCategory({
            ...form,
            auto_keywords: form.auto_keywords?.trim() || null,
          });
        }
        closeEditor();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al guardar.");
      }
    });
  }

  function handleDelete() {
    if (editor?.mode !== "edit") return;
    const id = editor.cat.id;
    startTransition(async () => {
      try {
        await deleteCategory(id);
        closeEditor();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al eliminar.");
      }
    });
  }

  return (
    <div className="relative">
      {/* ── Lista ── */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy">Categorías</h1>
            <p className="text-sm text-navy/40 mt-1">{categories.length} categorías · edita o crea nuevas</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <span className="text-base leading-none">+</span>
            Nueva categoría
          </button>
        </div>

        <div className="space-y-6">
          {GROUP_ORDER.map((g) => {
            // Categorías de este grupo + cualquier grupo desconocido cae bajo "operational"
            const items = categories.filter((c) =>
              c.group_type === g ||
              (g === "operational" && !KNOWN_GROUPS.has(c.group_type))
            );
            if (items.length === 0) return null;
            return (
              <div key={g}>
                <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-2 px-1">
                  {GROUP_LABELS[g]}
                </p>
                <div className="bg-white border border-navy/10 rounded-xl shadow-sm overflow-hidden">
                  {items.map((cat, i) => {
                    const isActive = editor?.mode === "edit" && editor.cat.id === cat.id;
                    return (
                      <div
                        key={cat.id}
                        className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                          i < items.length - 1 ? "border-b border-navy/[0.05]" : ""
                        } ${isActive ? "bg-primary/[0.04]" : "hover:bg-navy/[0.015]"}`}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{ backgroundColor: cat.bg_color }}
                        >
                          {cat.emoji}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy">{cat.label}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <code className="text-[10px] text-navy/30 font-mono">{cat.value}</code>
                            {cat.auto_keywords && (
                              <span className="text-[10px] text-navy/25">· {cat.auto_keywords}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: cat.bg_color }} />
                          <div className="w-5 h-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: cat.text_color }} />
                        </div>

                        <button
                          onClick={() => openEdit(cat)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-navy/25 hover:text-primary hover:bg-primary/[0.06] transition-colors shrink-0"
                          title="Editar"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Editor sidebar ── */}
      {editor && (
        <>
          <div className="fixed inset-0 z-40 bg-navy/10" onClick={closeEditor} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[400px] bg-white shadow-2xl flex flex-col border-l border-navy/10">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-navy/10">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ backgroundColor: form.bg_color }}
              >
                {form.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-navy">
                  {editor.mode === "new" ? "Nueva categoría" : "Editar categoría"}
                </h2>
                {editor.mode === "edit" && (
                  <p className="text-xs text-navy/40 font-mono mt-0.5">{editor.cat.value}</p>
                )}
              </div>
              <button
                onClick={closeEditor}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/30 hover:text-navy transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Emoji */}
              <div>
                <label className="block text-xs font-semibold text-navy/50 mb-1.5 uppercase tracking-wide">Emoji</label>
                <input
                  type="text"
                  value={form.emoji}
                  onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                  className="w-20 text-center text-2xl border border-navy/10 rounded-lg px-3 py-2 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                  maxLength={4}
                />
              </div>

              {/* Identificador */}
              <div>
                <label className="block text-xs font-semibold text-navy/50 mb-1.5 uppercase tracking-wide">
                  Identificador <span className="text-navy/30 font-normal normal-case">(clave interna, no cambiar si hay transacciones)</span>
                </label>
                <input
                  type="text"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  disabled={editor.mode === "edit"}
                  className="w-full text-sm font-mono border border-navy/10 rounded-lg px-3 py-2 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 disabled:bg-navy/[0.02] disabled:text-navy/40"
                  placeholder="Ej: Alquiler"
                />
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-navy/50 mb-1.5 uppercase tracking-wide">Nombre</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className="w-full text-sm border border-navy/10 rounded-lg px-3 py-2 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                  placeholder="Ej: Alquiler local"
                />
              </div>

              {/* Colores */}
              <div>
                <label className="block text-xs font-semibold text-navy/50 mb-1.5 uppercase tracking-wide">Colores</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="color"
                      value={form.bg_color}
                      onChange={(e) => setForm((f) => ({ ...f, bg_color: e.target.value }))}
                      className="w-9 h-9 rounded-lg border border-navy/10 cursor-pointer p-0.5"
                      title="Color de fondo"
                    />
                    <div>
                      <p className="text-[10px] text-navy/40">Fondo</p>
                      <p className="text-xs font-mono text-navy/60">{form.bg_color}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="color"
                      value={form.text_color}
                      onChange={(e) => setForm((f) => ({ ...f, text_color: e.target.value }))}
                      className="w-9 h-9 rounded-lg border border-navy/10 cursor-pointer p-0.5"
                      title="Color de texto"
                    />
                    <div>
                      <p className="text-[10px] text-navy/40">Texto</p>
                      <p className="text-xs font-mono text-navy/60">{form.text_color}</p>
                    </div>
                  </div>
                  <span
                    className="text-xs font-medium px-3 py-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: form.bg_color, color: form.text_color }}
                  >
                    {form.emoji} {form.label || "Nombre"}
                  </span>
                </div>
              </div>

              {/* Grupo */}
              <div>
                <label className="block text-xs font-semibold text-navy/50 mb-1.5 uppercase tracking-wide">Grupo</label>
                <div className="grid grid-cols-3 gap-2">
                  {GROUP_ORDER.map((g) => (
                    <button
                      key={g}
                      onClick={() => setForm((f) => ({ ...f, group_type: g }))}
                      className={`text-sm px-3 py-2 rounded-lg border transition-colors text-left ${
                        form.group_type === g
                          ? "border-primary bg-primary/[0.06] text-primary font-semibold"
                          : "border-navy/10 text-navy/50 hover:border-navy/20"
                      }`}
                    >
                      {GROUP_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-keywords */}
              <div>
                <label className="block text-xs font-semibold text-navy/50 mb-1.5 uppercase tracking-wide">
                  Auto-keywords <span className="text-navy/30 font-normal normal-case">(separadas por coma)</span>
                </label>
                <textarea
                  value={form.auto_keywords ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, auto_keywords: e.target.value || null }))}
                  rows={2}
                  className="w-full text-sm border border-navy/10 rounded-lg px-3 py-2 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 resize-none font-mono"
                  placeholder="endesa, iberdrola, naturgy"
                />
                <p className="text-[11px] text-navy/30 mt-1">
                  Si el concepto de una transacción contiene alguna de estas palabras, se categorizará automáticamente.
                </p>
              </div>

              {/* Orden */}
              <div>
                <label className="block text-xs font-semibold text-navy/50 mb-1.5 uppercase tracking-wide">Orden</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                  className="w-24 text-sm border border-navy/10 rounded-lg px-3 py-2 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
                  min={1}
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-navy/10 flex items-center gap-3">
              {editor.mode === "edit" && (
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-sm text-red-400 hover:text-red-600 transition-colors disabled:opacity-40 mr-auto"
                >
                  Eliminar
                </button>
              )}
              <button
                onClick={closeEditor}
                className="text-sm text-navy/40 hover:text-navy/60 transition-colors px-4 py-2"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="text-sm font-semibold px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 shadow-sm"
              >
                {isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
