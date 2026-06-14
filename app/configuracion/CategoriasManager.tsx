"use client";
import React, { useState, useTransition } from "react";
import type { Category, GroupType } from "@/lib/categories";
import { createCategory, updateCategory, deleteCategory } from "./actions";

const GROUP_LABELS: Record<GroupType, string> = {
  operational: "Operacional",
  income: "Ingresos",
  transfer: "Financiación",
  internal: "Traspasos internos",
};
const GROUP_ORDER: GroupType[] = ["income", "operational", "transfer", "internal"];
const KNOWN_GROUPS = new Set<string>(["income", "transfer", "operational", "internal"]);

// ── Color palette ─────────────────────────────────────────────────────────────

const PALETTE = [
  "#4021c8", "#7c3aed", "#2563eb", "#0891b2", "#298a83",
  "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#db2777",
  "#64748b", "#374151",
];

// ── Icon set ──────────────────────────────────────────────────────────────────

type IconKey = string;

const ICONS: { key: IconKey; path: React.ReactNode }[] = [
  { key: "home", path: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></> },
  { key: "users", path: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
  { key: "zap", path: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></> },
  { key: "droplet", path: <><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></> },
  { key: "monitor", path: <><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></> },
  { key: "file-text", path: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></> },
  { key: "percent", path: <><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></> },
  { key: "phone", path: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 2.72h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.9a16 16 0 0 0 6.09 6.09l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"/></> },
  { key: "shield", path: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></> },
  { key: "credit-card", path: <><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></> },
  { key: "shopping-bag", path: <><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></> },
  { key: "settings", path: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></> },
  { key: "bar-chart", path: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></> },
  { key: "trending-up", path: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></> },
  { key: "truck", path: <><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></> },
  { key: "briefcase", path: <><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></> },
  { key: "globe", path: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></> },
  { key: "package", path: <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></> },
  { key: "coffee", path: <><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></> },
  { key: "star", path: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></> },
  { key: "repeat", path: <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></> },
];

const ICON_MAP = new Map(ICONS.map((i) => [i.key, i.path]));

// Mapeo por nombre de categoría → clave de icono (fallback para datos existentes en DB)
const NAME_TO_KEY: Record<string, string> = {
  "Ingresos Stripe": "trending-up", "Ingresos USC": "trending-up",
  "Alquiler": "home", "Local": "home",
  "Salarios": "users",
  "Seguridad social": "shield",
  "Gestoría y legal": "file-text",
  "Impuestos y tasas": "percent",
  "Software": "monitor",
  "Electricidad": "zap",
  "Agua": "droplet",
  "Teléfono": "phone",
  "Seguros": "briefcase",
  "Comisiones bancarias": "credit-card",
  "Merchandising": "shopping-bag",
  "Material y maquinaria": "settings",
  "Inversión": "bar-chart",
  "Traspasos internos": "repeat",
};

function CategoryIcon({ iconKey, name, color, size = 40 }: { iconKey: string; name?: string; color: string; size?: number }) {
  const key = ICON_MAP.has(iconKey) ? iconKey : (name ? (NAME_TO_KEY[name] ?? "package") : "package");
  const path = ICON_MAP.get(key) ?? ICON_MAP.get("package")!;
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <svg
        width={size * 0.45}
        height={size * 0.45}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {path}
      </svg>
    </div>
  );
}

// ── Color derivation ──────────────────────────────────────────────────────────

function deriveColors(accent: string): { bg_color: string; text_color: string } {
  return { bg_color: accent, text_color: accent };
}

// ── Default form ──────────────────────────────────────────────────────────────

const DEFAULT_COLOR = PALETTE[0];
const DEFAULT_ICON = "package";

const EMPTY: Omit<Category, "id" | "created_at"> = {
  value: "",
  label: "",
  emoji: DEFAULT_ICON,
  ...deriveColors(DEFAULT_COLOR),
  group_type: "operational",
  auto_keywords: null,
  sort_order: 99,
};

type EditorState = { mode: "new" } | { mode: "edit"; cat: Category };

export default function CategoriasManager({ categories }: { categories: Category[] }) {
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [form, setForm] = useState<Omit<Category, "id" | "created_at">>(EMPTY);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleColorSelect(hex: string) {
    setSelectedColor(hex);
    setForm((f) => ({ ...f, ...deriveColors(hex) }));
  }

  function handleIconSelect(key: string) {
    setForm((f) => ({ ...f, emoji: key }));
  }

  function openNew() {
    setSelectedColor(DEFAULT_COLOR);
    setForm({ ...EMPTY, sort_order: categories.length + 1 });
    setEditor({ mode: "new" });
    setError(null);
  }

  function openEdit(cat: Category) {
    const color = cat.text_color ?? DEFAULT_COLOR;
    setSelectedColor(color);
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
    if (!form.label.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const value = form.value.trim() || form.label.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-áéíóúñü]/g, "");
    startTransition(async () => {
      try {
        if (editor?.mode === "edit") {
          await updateCategory(editor.cat.id, {
            ...form,
            value: editor.cat.value,
            auto_keywords: form.auto_keywords?.trim() || null,
          });
        } else {
          await createCategory({
            ...form,
            value,
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Configuración</h1>
            <p className="text-sm text-navy/55 mt-1">{categories.length} categorías</p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nueva categoría
          </button>
        </div>

        <div className="space-y-8">
          {GROUP_ORDER.map((g) => {
            const items = categories.filter((c) =>
              c.group_type === g ||
              (g === "operational" && !KNOWN_GROUPS.has(c.group_type))
            );
            if (items.length === 0) return null;
            return (
              <div key={g}>
                <p className="text-[11px] font-semibold text-navy/45 uppercase tracking-wider mb-3 px-1">
                  {GROUP_LABELS[g]}
                </p>
                <div className="bg-white border border-navy/[0.08] rounded-2xl shadow-card overflow-hidden">
                  {items.map((cat, i) => {
                    const isActive = editor?.mode === "edit" && editor.cat.id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => openEdit(cat)}
                        className={`w-full flex items-center gap-4 px-5 py-3.5 transition-colors text-left ${
                          i < items.length - 1 ? "border-b border-navy/[0.05]" : ""
                        } ${isActive ? "bg-primary/[0.04]" : "hover:bg-navy/[0.015]"}`}
                      >
                        <CategoryIcon iconKey={cat.emoji} name={cat.label} color={cat.text_color} size={40} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy">{cat.label}</p>
                          {cat.auto_keywords && (
                            <p className="text-[11px] text-navy/40 mt-0.5 truncate">{cat.auto_keywords}</p>
                          )}
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy/25 shrink-0">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Editor panel ── */}
      {editor && (
        <>
          <div className="fixed inset-0 z-40 bg-navy/10" onClick={closeEditor} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col border-l border-navy/10">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-navy/[0.08]">
              <CategoryIcon iconKey={form.emoji} color={selectedColor} size={44} />
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-navy truncate">
                  {form.label || (editor.mode === "new" ? "Nueva categoría" : "Editar categoría")}
                </p>
                <p className="text-xs text-navy/40 font-mono mt-0.5">
                  {editor.mode === "edit" ? editor.cat.value : "nueva"}
                </p>
              </div>
              <button
                onClick={closeEditor}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/40 hover:text-navy transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-7">

              {/* Nombre */}
              <div>
                <label className="block text-xs font-semibold text-navy/45 uppercase tracking-wider mb-2">Nombre</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Ej: Alquiler local"
                  className="w-full text-sm border border-navy/[0.12] rounded-xl px-4 py-3 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 text-navy placeholder:text-navy/30"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-semibold text-navy/45 uppercase tracking-wider mb-3">Color</label>
                <div className="flex flex-wrap gap-3">
                  {PALETTE.map((hex) => (
                    <button
                      key={hex}
                      onClick={() => handleColorSelect(hex)}
                      className="w-9 h-9 rounded-full transition-transform hover:scale-110 relative"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    >
                      {selectedColor === hex && (
                        <span className="absolute inset-0 rounded-full ring-2 ring-offset-2 ring-current" style={{ color: hex }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Icono */}
              <div>
                <label className="block text-xs font-semibold text-navy/45 uppercase tracking-wider mb-3">Icono</label>
                <div className="grid grid-cols-7 gap-2">
                  {ICONS.map(({ key }) => {
                    const isSelected = form.emoji === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleIconSelect(key)}
                        className={`relative flex items-center justify-center rounded-full w-10 h-10 transition-all ${
                          isSelected ? "scale-110" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: selectedColor }}
                        title={key}
                      >
                        {isSelected && (
                          <span className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 2px white, 0 0 0 3.5px ${selectedColor}` }} />
                        )}
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {ICON_MAP.get(key)}
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grupo */}
              <div>
                <label className="block text-xs font-semibold text-navy/45 uppercase tracking-wider mb-2">Grupo</label>
                <div className="grid grid-cols-3 gap-2">
                  {GROUP_ORDER.map((g) => (
                    <button
                      key={g}
                      onClick={() => setForm((f) => ({ ...f, group_type: g }))}
                      className={`text-sm px-3 py-2 rounded-xl border transition-colors ${
                        form.group_type === g
                          ? "border-primary bg-primary/[0.06] text-primary font-semibold"
                          : "border-navy/[0.10] text-navy/50 hover:border-navy/20"
                      }`}
                    >
                      {GROUP_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-keywords */}
              <div>
                <label className="block text-xs font-semibold text-navy/45 uppercase tracking-wider mb-2">
                  Auto-keywords <span className="font-normal normal-case text-navy/35">(separadas por coma)</span>
                </label>
                <textarea
                  value={form.auto_keywords ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, auto_keywords: e.target.value || null }))}
                  rows={2}
                  className="w-full text-sm border border-navy/[0.12] rounded-xl px-4 py-3 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 resize-none font-mono text-navy placeholder:text-navy/30"
                  placeholder="endesa, iberdrola, naturgy"
                />
                <p className="text-[11px] text-navy/35 mt-1.5">
                  Si el concepto contiene alguna de estas palabras, la transacción se categorizará automáticamente.
                </p>
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-navy/[0.08] flex items-center gap-3">
              {editor.mode === "edit" && (
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-sm text-navy/40 hover:text-danger transition-colors disabled:opacity-40 mr-auto"
                >
                  Eliminar
                </button>
              )}
              <button
                onClick={closeEditor}
                className="text-sm text-navy/50 hover:text-navy transition-colors px-4 py-2"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !form.label.trim()}
                className="text-sm font-semibold px-6 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 shadow-sm"
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
