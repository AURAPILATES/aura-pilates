"use client";
import React, { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Category, GroupType } from "@/lib/categories";
import { sortCategoriesHierarchical, categoryDisplayLabel } from "@/lib/categories";
import { economicGroupOf, type EconomicGroup } from "@/lib/economicGroups";
import { siblingColor } from "@/lib/colorVariants";
import { normalizeText } from "@/lib/normalizeText";
import { drawerNav } from "@/lib/drawerNav";
import { createCategory, updateCategory, deleteCategory, reorderCategories, updateCategoryColors } from "./actions";
import ChipsInput from "@/app/components/ChipsInput";
import Button, { SecondaryButton, DeleteButton, DangerButtonSolid } from "@/app/components/Button";
import Select from "@/app/components/Select";
import Field from "@/app/components/Field";
import { AutomationIcon } from "@/app/transacciones/NewContactDrawer";
import CategoriasManagerV2 from "./CategoriasManagerV2";

const GROUP_LABELS: Record<GroupType, string> = {
  operational: "Operacional",
  income: "Ingresos",
  transfer: "Financiación",
  internal: "Traspasos internos",
};
const GROUP_ORDER: GroupType[] = ["income", "operational", "transfer", "internal"];
const KNOWN_GROUPS = new Set<string>(["income", "transfer", "operational", "internal"]);

// Tooltip de una frase por Grupo, para quien no recuerde la diferencia entre p.ej.
// "Financiación" y "Traspasos internos" sin tener que abrir el manual.
const GROUP_HELP: Record<GroupType, string> = {
  income: "Dinero que entra: ventas, cuotas y clases.",
  operational: "Gasto del día a día del negocio: alquiler, suministros, salarios…",
  transfer: "Préstamos, aportaciones de socios o su devolución - no es venta ni gasto operativo.",
  internal: "Movimientos entre tus propias cuentas; no cuentan como ingreso ni gasto real.",
};

// Subdivisión por naturaleza económica, solo dentro de "Operacional" - por defecto derivada
// del nombre de la categoría (ver lib/economicGroups.ts), pero se puede fijar a mano y en ese
// caso sí se persiste tal cual en BD (ver handleSave).
const ECONOMIC_LABELS: Record<EconomicGroup, string> = {
  personal: "Personal",
  operational: "Gasto operativo (OpEx)",
  capex: "Inversión (CapEx)",
  financiacion: "Financiación",
};
const ECONOMIC_ORDER: EconomicGroup[] = ["personal", "operational", "capex"];
const ECONOMIC_HELP: Partial<Record<EconomicGroup, string>> = {
  personal: "Salarios y seguridad social del equipo.",
  operational: "Gasto corriente del día a día: suministros, software, alquiler…",
  capex: "Compra de activos que duran en el tiempo: maquinaria, reforma, mobiliario…",
};

/** Cada padre presente en `list` va seguido de sus subcategorías presentes en `list`. */
function byParentOrdered(list: Category[]): Category[] {
  const present = new Set(list.map((c) => c.id));
  const byParent = new Map<string | null, Category[]>();
  for (const c of list) {
    // Si el padre no está en esta sublista (p.ej. por grupo/naturaleza), se trata como raíz
    // para no perder la categoría; así también funcionan los niveles anidados.
    const key = c.parent_id && present.has(c.parent_id) ? c.parent_id : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(c);
  }
  for (const l of byParent.values()) l.sort((a, b) => a.sort_order - b.sort_order);
  const result: Category[] = [];
  const visit = (key: string | null) => {
    for (const cat of byParent.get(key) ?? []) {
      result.push(cat);
      visit(cat.id);
    }
  };
  visit(null);
  return result;
}

/** Orden canónico de todas las categorías tal como se muestran en esta pantalla (grupo → naturaleza económica → padre/hijos). */
function flattenDisplayOrder(all: Category[]): Category[] {
  const result: Category[] = [];
  for (const g of GROUP_ORDER) {
    const items = all.filter((c) => c.group_type === g || (g === "operational" && !KNOWN_GROUPS.has(c.group_type)));
    if (g === "operational") {
      for (const eg of ECONOMIC_ORDER) {
        result.push(...byParentOrdered(items.filter((c) => economicGroupOf(c.label, c.economic_group) === eg)));
      }
    } else {
      result.push(...byParentOrdered(items));
    }
  }
  return result;
}

// ── Color palette ─────────────────────────────────────────────────────────────

const PALETTE = [
  "#1E8C5A", "#52B788", "#3A56C5", "#6C8EDB", "#D4621A",
  "#C0392B", "#E8A020", "#B7791F", "#0E7FA3", "#D4A017",
  "#7B3FA0", "#A05C8A",
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
  { key: "activity", path: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></> },
  { key: "heart", path: <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></> },
  { key: "calendar", path: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></> },
  { key: "mail", path: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></> },
  { key: "tag", path: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></> },
  { key: "gift", path: <><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></> },
  { key: "camera", path: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></> },
  { key: "music", path: <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></> },
  { key: "award", path: <><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></> },
  { key: "book-open", path: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></> },
  { key: "clipboard", path: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></> },
  { key: "key", path: <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></> },
  { key: "tool", path: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></> },
  { key: "scissors", path: <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></> },
  { key: "clock", path: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
];

const ICON_MAP = new Map(ICONS.map((i) => [i.key, i.path]));

// Mapeo por nombre de categoría → clave de icono (fallback para datos existentes en DB)
const NAME_TO_KEY: Record<string, string> = {
  "Ingresos Stripe": "trending-up", "Ingresos USC": "trending-up",
  "Alquiler": "home", "Local": "home",
  "Salarios": "users",
  "Seguridad social": "shield",
  "Gestoría y legal": "file-text",
  "Impuestos y tasas": "percent", "IVA": "percent", "IRPF": "percent", "IS": "percent",
  "Software": "monitor",
  "Suministros": "zap",
  "Electricidad": "zap", "Luz": "zap",
  "Agua": "droplet",
  "Teléfono": "phone",
  "Seguros": "briefcase",
  "Comisiones bancarias": "credit-card",
  "Merchandising": "shopping-bag",
  "Material y maquinaria": "settings",
  "Inversión": "bar-chart",
  "Traspasos internos": "repeat",
};

export function CategoryIcon({ iconKey, name, color, size = 40 }: { iconKey: string; name?: string; color: string; size?: number }) {
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
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  return {
    bg_color: `rgba(${r}, ${g}, ${b}, 0.12)`,
    text_color: accent,
  };
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
  parent_id: null,
  economic_group: null,
};

type EditorState = { mode: "new" } | { mode: "edit"; cat: Category };

export default function CategoriasManager({
  categories: categoriesProp,
  categoryCounts,
}: {
  categories: Category[];
  categoryCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(categoriesProp);
  useEffect(() => setCategories(categoriesProp), [categoriesProp]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<Omit<Category, "id" | "created_at">>(EMPTY);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [error, setError] = useState<string | null>(null);
  // Selector desplegable de Color/Icono (uno u otro abierto), con cierre al clicar fuera.
  const [openPicker, setOpenPicker] = useState<null | "color" | "icon">(null);
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openPicker) return;
    const handle = (e: MouseEvent) => {
      if (!pickerWrapRef.current?.contains(e.target as Node)) setOpenPicker(null);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [openPicker]);
  const [isPending, startTransition] = useTransition();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  /** Trx propias + las de toda su rama de descendientes (una categoría padre es el sumatorio
   * de su subárbol, a cualquier profundidad). */
  function totalCount(cat: Category): number {
    const own = categoryCounts[cat.value] ?? 0;
    const childrenCount = categories
      .filter((c) => c.parent_id === cat.id)
      .reduce((sum, c) => sum + totalCount(c), 0);
    return own + childrenCount;
  }

  // ── Jerarquía de hasta 3 niveles (índices 0,1,2) ──────────────────────────────
  const MAX_DEPTH = 2;
  function depthOf(cat: Category): number {
    let d = 0;
    let cur: Category | undefined = cat;
    const seen = new Set<string>();
    while (cur?.parent_id && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = categories.find((c) => c.id === cur!.parent_id);
      if (cur) d++;
    }
    return d;
  }
  function subtreeHeight(cat: Category): number {
    const children = categories.filter((c) => c.parent_id === cat.id);
    return children.length === 0 ? 0 : 1 + Math.max(...children.map(subtreeHeight));
  }
  function descendantIds(cat: Category): Set<string> {
    const ids = new Set<string>();
    const stack = [cat.id];
    while (stack.length) {
      const id = stack.pop()!;
      for (const c of categories) {
        if (c.parent_id === id && !ids.has(c.id)) { ids.add(c.id); stack.push(c.id); }
      }
    }
    return ids;
  }
  // Padres válidos para la categoría del editor: los que, tras anidarla, no superen los 3
  // niveles y no creen un ciclo (excluye la propia categoría y sus descendientes).
  const editingCat = editor?.mode === "edit" ? editor.cat : null;
  const editingHeight = editingCat ? subtreeHeight(editingCat) : 0;
  const excludedParentIds = editingCat ? new Set([editingCat.id, ...descendantIds(editingCat)]) : new Set<string>();
  const parentOptions = sortCategoriesHierarchical(categories).filter(
    (c) => !excludedParentIds.has(c.id) && depthOf(c) + 1 + editingHeight <= MAX_DEPTH,
  );
  // Con categoría padre, el grupo y la naturaleza económica se heredan de ella (no se editan).
  const hasParent = !!form.parent_id;
  const parentCat = form.parent_id ? categories.find((c) => c.id === form.parent_id) : null;

  // Núcleo compartido de "mover dentro de una sublista" - lo usa tanto soltar un arrastre
  // (handleDrop, ratón) como las flechas subir/bajar (moveStep, táctil - ver más abajo por qué
  // hacen falta: el arrastre nativo no dispara eventos con el dedo).
  function applyReorder(list: Category[], dragId: string, targetId: string) {
    if (dragId === targetId) return;
    const dragIdx = list.findIndex((c) => c.id === dragId);
    const targetIdx = list.findIndex((c) => c.id === targetId);
    if (dragIdx === -1 || targetIdx === -1) return;

    const reordered = [...list];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    // Renumera localmente la sublista arrastrada y luego recalcula el sort_order
    // global de TODAS las categorías a partir del orden de pantalla resultante,
    // para que el orden se mantenga consistente en cualquier lista/selector de la app.
    const localRank = new Map(reordered.map((c, i) => [c.id, i]));
    const patched = categories.map((c) => (localRank.has(c.id) ? { ...c, sort_order: localRank.get(c.id)! } : c));
    const renumbered = flattenDisplayOrder(patched).map((c, i) => ({ ...c, sort_order: i + 1 }));

    setCategories(renumbered);
    startTransition(async () => {
      try {
        await reorderCategories(renumbered.map((c) => ({ id: c.id, sort_order: c.sort_order })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al reordenar.");
      }
    });
  }

  function handleDrop(list: Category[], targetId: string) {
    const dragId = draggedId;
    setDraggedId(null);
    setDragOverId(null);
    if (!dragId) return;
    applyReorder(list, dragId, targetId);
  }

  /** Sube/baja una categoría una posición dentro de su misma sublista - alternativa al
   * arrastre para móvil: `draggable` es drag-and-drop nativo del navegador y no dispara nada
   * con eventos táctiles, así que en pantalla táctil el asa de arrastrar no hacía nada. */
  function moveStep(list: Category[], id: string, direction: -1 | 1) {
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    applyReorder(list, id, list[targetIdx].id);
  }

  function handleColorSelect(hex: string) {
    setSelectedColor(hex);
    setForm((f) => ({ ...f, ...deriveColors(hex) }));
  }

  function handleParentSelect(parentId: string) {
    if (!parentId) {
      setForm((f) => ({ ...f, parent_id: null }));
      return;
    }
    const parent = categories.find((c) => c.id === parentId);
    const siblings = categories.filter(
      (c) => c.parent_id === parentId && (editor?.mode !== "edit" || c.id !== editor.cat.id),
    );
    const hex = parent ? siblingColor(parent.text_color, siblings.length, siblings.length + 1) : DEFAULT_COLOR;
    setSelectedColor(hex);
    setForm((f) => ({
      ...f,
      parent_id: parentId,
      ...deriveColors(hex),
      // El grupo y la naturaleza económica se heredan del padre (el hijo cuelga de su rama).
      ...(parent
        ? {
            group_type: parent.group_type,
            economic_group: parent.group_type === "operational"
              ? economicGroupOf(parent.label, parent.economic_group)
              : parent.economic_group,
          }
        : {}),
    }));
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

  /** Abre el editor "nueva categoría" ya vinculada a un padre (color/grupo/naturaleza heredados). */
  function openNewWithParent(parentId: string) {
    setSelectedColor(DEFAULT_COLOR);
    setForm({ ...EMPTY, sort_order: categories.length + 1 });
    setEditor({ mode: "new" });
    setError(null);
    handleParentSelect(parentId);
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
      parent_id: cat.parent_id,
      economic_group: cat.economic_group,
    });
    setEditor({ mode: "edit", cat });
    setError(null);
    setConfirmDelete(false);
  }

  function closeEditor() {
    setEditor(null);
    setError(null);
    setConfirmDelete(false);
  }

  function handleSave() {
    if (!form.label.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    const value = form.value.trim() || form.label.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-áéíóúñü]/g, "");
    // Si la naturaleza económica no se ha fijado a mano, se guarda ya resuelta según el nombre
    // actual en vez de dejarla en null - si no, un cambio de nombre más adelante la reclasifica
    // sin que nadie lo note (economicGroupOf solo reconoce coincidencias exactas de nombre).
    const economic_group = !form.parent_id && form.group_type === "operational" && !form.economic_group
      ? economicGroupOf(form.label, null)
      : form.economic_group;
    startTransition(async () => {
      try {
        if (editor?.mode === "edit") {
          await updateCategory(editor.cat.id, {
            ...form,
            economic_group,
            value: editor.cat.value,
            auto_keywords: form.auto_keywords?.trim() || null,
          });
          if (!editor.cat.parent_id && form.text_color !== editor.cat.text_color) {
            const children = categories
              .filter((c) => c.parent_id === editor.cat.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            if (children.length > 0) {
              const childUpdates = children.map((c, i) => ({
                id: c.id,
                ...deriveColors(siblingColor(form.text_color, i, children.length)),
              }));
              await updateCategoryColors(childUpdates);
            }
          }
        } else {
          await createCategory({
            ...form,
            economic_group,
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

  // Filtro de búsqueda: mantiene visibles todos los ancestros de cualquier categoría que
  // coincida, para no perder el contexto de jerarquía (a cualquier profundidad) aunque el
  // padre o abuelo no coincidan con el texto buscado.
  const q = normalizeText(search).trim();
  const filteredCategories = q
    ? (() => {
        const directMatch = (c: Category) =>
          normalizeText(c.label).includes(q) || normalizeText(c.auto_keywords ?? "").includes(q);
        const byId = new Map(categories.map((c) => [c.id, c]));
        const visibleIds = new Set(categories.filter(directMatch).map((c) => c.id));
        for (const id of [...visibleIds]) {
          let cur = byId.get(id);
          const seen = new Set<string>();
          while (cur?.parent_id && !seen.has(cur.id)) {
            seen.add(cur.id);
            visibleIds.add(cur.parent_id);
            cur = byId.get(cur.parent_id);
          }
        }
        return categories.filter((c) => visibleIds.has(c.id));
      })()
    : categories;

  // Lista aplanada para la vista v2 (una entrada por caja/subgrupo, en el mismo orden que
  // renderItems() usa abajo para la vista clásica) - evita duplicar el algoritmo de agrupado.
  const displayGroups: { sectionLabel?: string; subsectionLabel?: string; ordered: Category[] }[] = [];
  for (const g of GROUP_ORDER) {
    const items = filteredCategories.filter((c) => c.group_type === g || (g === "operational" && !KNOWN_GROUPS.has(c.group_type)));
    if (items.length === 0) continue;
    if (g === "operational") {
      let firstInSection = true;
      for (const eg of ECONOMIC_ORDER) {
        const subItems = items.filter((c) => economicGroupOf(c.label, c.economic_group) === eg);
        if (subItems.length === 0) continue;
        displayGroups.push({
          sectionLabel: firstInSection ? GROUP_LABELS[g] : undefined,
          subsectionLabel: ECONOMIC_LABELS[eg],
          ordered: byParentOrdered(subItems),
        });
        firstInSection = false;
      }
    } else {
      displayGroups.push({ sectionLabel: GROUP_LABELS[g], ordered: byParentOrdered(items) });
    }
  }

  // Anterior/siguiente para el editor: navega sobre el mismo orden visible en pantalla (respeta
  // la búsqueda), solo tiene sentido editando una categoría existente (no al crear una nueva).
  const flatCategoryOrder = displayGroups.flatMap((g) => g.ordered);
  const { prev: prevCat, next: nextCat } =
    editor?.mode === "edit" ? drawerNav(flatCategoryOrder, editor.cat.id, (c) => c.id) : { prev: null, next: null };

  // Este panel (nueva/editar categoría) no usa el <Drawer> compartido (es un panel lateral a
  // medida), así que no hereda ni su cierre con Escape ni la navegación ↑/↓ - se replican aquí.
  useEffect(() => {
    if (!editor) return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") { closeEditor(); return; }
      const el = ev.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (ev.key === "ArrowUp" && prevCat) { ev.preventDefault(); openEdit(prevCat); }
      else if (ev.key === "ArrowDown" && nextCat) { ev.preventDefault(); openEdit(nextCat); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [editor, prevCat, nextCat]);

  return (
    <div className="relative">
      {/* ── Lista ── */}
      <CategoriasManagerV2
        totalCategories={categories.length}
        groups={displayGroups}
        totalCount={totalCount}
        search={search}
        onSearchChange={setSearch}
        draggedId={draggedId}
        dragOverId={dragOverId}
        onDragStart={setDraggedId}
        onDragOver={setDragOverId}
        onDragLeave={(id) => setDragOverId((cur) => (cur === id ? null : cur))}
        onDrop={handleDrop}
        onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
        onMoveStep={moveStep}
        onNewCategory={openNew}
        onNewSubcategory={openNewWithParent}
        onEditCategory={openEdit}
        onViewTransactions={(cat) => router.push(`/transacciones?categoria=${encodeURIComponent(cat.value)}`)}
      />

      {/* ── Editor panel ── */}
      {editor && (
        <>
          <div className="fixed inset-0 z-40 bg-navy/10" onClick={closeEditor} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-card shadow-2xl flex flex-col border-l border-navy/10">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-navy/[0.08]">
              <CategoryIcon iconKey={form.emoji} color={selectedColor} size={44} />
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-navy truncate">
                  {form.label || (editor.mode === "new"
                    ? (form.parent_id ? "Nueva subcategoría" : "Nueva categoría")
                    : "Editar categoría")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {editor.mode === "edit" && (
                  <div className="flex items-center rounded-lg border border-navy/[0.12] bg-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => prevCat && openEdit(prevCat)}
                      disabled={!prevCat}
                      title="Categoría anterior (↑)"
                      className="w-7 h-7 flex items-center justify-center text-navy/40 hover:text-navy hover:bg-navy/[0.04] disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-default transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                    <div className="w-px h-4 bg-navy/[0.12]" />
                    <button
                      type="button"
                      onClick={() => nextCat && openEdit(nextCat)}
                      disabled={!nextCat}
                      title="Siguiente categoría (↓)"
                      className="w-7 h-7 flex items-center justify-center text-navy/40 hover:text-navy hover:bg-navy/[0.04] disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-default transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                )}
                <button
                  onClick={closeEditor}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/40 hover:text-navy transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-[12px]">

              {/* Nombre */}
              <Field label="Nombre">
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Ej: Alquiler local"
                  className="w-full bg-transparent outline-none placeholder:text-navy/30"
                />
              </Field>

              {/* Color e Icono, en dos selectores compactos lado a lado */}
              <div ref={pickerWrapRef} className="grid grid-cols-2 gap-3">
                {/* Color */}
                <Field label="Color" className="relative">
                  {form.parent_id ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0" title="Hereda el tono de su categoría padre, con un matiz distinto para diferenciarla de sus hermanas.">
                      <span className="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: selectedColor }} />
                      <span className="text-[11px] text-navy/45 leading-tight">Hereda del padre</span>
                    </div>
                  ) : (
                    <div className="relative flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => setOpenPicker((p) => (p === "color" ? null : "color"))}
                        className="w-full flex items-center justify-between gap-2 hover:opacity-80 transition-opacity"
                      >
                        <span className="w-6 h-6 rounded-full shrink-0" style={{ backgroundColor: selectedColor }} />
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-navy/35 transition-transform ${openPicker === "color" ? "rotate-180" : ""}`}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {openPicker === "color" && (
                        <div className="absolute z-20 top-full mt-1.5 left-0 bg-card border border-navy/10 rounded-xl shadow-lg p-3">
                          <div className="grid grid-cols-6 gap-2">
                            {PALETTE.map((hex) => (
                              <button
                                key={hex}
                                type="button"
                                onClick={() => { handleColorSelect(hex); setOpenPicker(null); }}
                                className="w-7 h-7 rounded-full transition-transform hover:scale-110 relative"
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
                      )}
                    </div>
                  )}
                </Field>

                {/* Icono */}
                <Field label="Icono" className="relative">
                  <div className="relative flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setOpenPicker((p) => (p === "icon" ? null : "icon"))}
                      className="w-full flex items-center justify-between gap-2 hover:opacity-80 transition-opacity"
                    >
                      <CategoryIcon iconKey={form.emoji} color={selectedColor} size={24} />
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-navy/35 transition-transform ${openPicker === "icon" ? "rotate-180" : ""}`}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {openPicker === "icon" && (
                      <div className="absolute z-20 top-full mt-1.5 right-0 w-[236px] max-w-[80vw] max-h-[240px] overflow-y-auto bg-card border border-navy/10 rounded-xl shadow-lg p-3">
                        <div className="grid grid-cols-6 gap-2">
                          {ICONS.map(({ key }) => {
                            const isSelected = form.emoji === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => { handleIconSelect(key); setOpenPicker(null); }}
                                className={`relative flex items-center justify-center rounded-full w-8 h-8 transition-all ${
                                  isSelected ? "scale-110" : "hover:scale-105"
                                }`}
                                style={{ backgroundColor: selectedColor }}
                                title={key}
                              >
                                {isSelected && (
                                  <span className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 0 2px var(--color-card), 0 0 0 3.5px ${selectedColor}` }} />
                                )}
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  {ICON_MAP.get(key)}
                                </svg>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </Field>
              </div>

              {/* Categoría padre */}
              <Field label={<>Categoría padre <span className="font-normal text-navy/35">(opcional, para crear una subcategoría)</span></>}>
                {parentOptions.length === 0 ? (
                  <p className="text-navy/45 leading-snug">
                    {editingHeight >= MAX_DEPTH
                      ? "Esta categoría ya tiene su propia jerarquía de subcategorías, así que no puede anidarse bajo otra (el máximo son tres niveles)."
                      : "No hay ninguna categoría bajo la que anidar esta."}
                  </p>
                ) : (
                  <Select variant="bare" value={form.parent_id ?? ""} onChange={(e) => handleParentSelect(e.target.value)}>
                    <option value="">- Sin categoría padre -</option>
                    {parentOptions.map((c) => (
                      <option key={c.id} value={c.id}>{categoryDisplayLabel(c, categories)}</option>
                    ))}
                  </Select>
                )}
              </Field>

              {/* Clasificación: Grupo + Naturaleza agrupados bajo el mismo epígrafe, porque
                  Naturaleza es una subdivisión que solo existe dentro del grupo Operacional
                  (no son dos campos independientes, aunque se guarden en columnas separadas). */}
              <div className="p-3.5 bg-navy/[0.03] border border-navy/[0.08] rounded-xl space-y-4">
                <label className="block text-xs font-medium text-navy/55">Clasificación</label>

                {hasParent ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs px-3 py-1.5 rounded-full bg-navy/[0.07] text-navy/70 font-medium">
                        {GROUP_LABELS[form.group_type]}
                      </span>
                      {form.group_type === "operational" && (
                        <span className="text-xs px-3 py-1.5 rounded-full bg-navy/[0.07] text-navy/70 font-medium">
                          {ECONOMIC_LABELS[economicGroupOf(form.label, form.economic_group)]}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-navy/35 mt-2">
                      Heredado de {parentCat ? `"${parentCat.label}"` : "la categoría padre"}. Quita la categoría padre arriba para fijarlo a mano.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-[11px] font-medium text-navy/55 mb-2">Grupo</p>
                      <div className="grid grid-cols-3 gap-2">
                        {GROUP_ORDER.map((g) => (
                          <button
                            key={g}
                            onClick={() => setForm((f) => ({ ...f, group_type: g }))}
                            title={GROUP_HELP[g]}
                            className={`text-xs px-3 py-2 rounded-xl border transition-colors ${
                              form.group_type === g
                                ? "border-navy bg-navy/[0.06] text-navy font-semibold"
                                : "border-navy/[0.10] text-navy/50 hover:border-navy/20"
                            }`}
                          >
                            {GROUP_LABELS[g]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.group_type === "operational" && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-medium text-navy/55">Naturaleza económica</p>
                          {form.economic_group && (
                            <button
                              onClick={() => setForm((f) => ({ ...f, economic_group: null }))}
                              className="text-[11px] text-primary/70 hover:text-primary underline underline-offset-2"
                            >
                              Volver a automático
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {ECONOMIC_ORDER.map((eg) => {
                            const isActive = economicGroupOf(form.label, form.economic_group) === eg;
                            return (
                              <button
                                key={eg}
                                onClick={() => setForm((f) => ({ ...f, economic_group: eg }))}
                                title={ECONOMIC_HELP[eg]}
                                className={`text-xs px-3 py-2 rounded-xl border transition-colors ${
                                  isActive
                                    ? "border-navy bg-navy/[0.06] text-navy font-semibold"
                                    : "border-navy/[0.10] text-navy/50 hover:border-navy/20"
                                }`}
                              >
                                {ECONOMIC_LABELS[eg]}
                                {isActive && (
                                  <span className="block text-[9px] font-normal opacity-55 mt-0.5">
                                    {form.economic_group ? "fijado a mano" : "automático"}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-navy/35 mt-1.5">
                          {form.economic_group
                            ? "Fijado a mano: no cambiará aunque renombres la categoría."
                            : "Se deduce del nombre. Si lo fijas a mano, quedará congelado aunque cambies el nombre más adelante."}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Conceptos bancarios */}
              <div className="p-3.5 bg-primary/[0.06] border border-primary/15 rounded-xl">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-primary/80 mb-1.5">
                  <AutomationIcon />
                  Conceptos bancarios
                </label>
                <ChipsInput
                  values={(form.auto_keywords ?? "").split(",").map((s) => s.trim()).filter(Boolean)}
                  onChange={(next) => setForm((f) => ({ ...f, auto_keywords: next.length ? next.join(", ") : null }))}
                  placeholder="ej. endesa, iberdrola… (Enter para añadir)"
                />
                <p className="text-[11px] text-navy/35 mt-1.5">
                  Si el concepto contiene alguno de estos textos, la transacción se categorizará automáticamente.
                </p>
              </div>

              {error && (
                <p className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/15 rounded-xl px-4 py-3">{error}</p>
              )}
            </div>

            {/* Footer - nunca más de 2 botones: crear = Cancelar+Guardar, editar =
                Guardar+Eliminar (la X ya cierra, no hace falta Cancelar); al pulsar Eliminar,
                el footer pasa a Cancelar+Eliminar (confirmación), nunca los 3 a la vez. */}
            {editor.mode === "edit" && confirmDelete ? (() => {
              const directCount = categoryCounts[editor.cat.value] ?? 0;
              const childCount = categories.filter((c) => c.parent_id === editor.cat.id).length;
              return (
                <div className="px-5 py-4 border-t border-navy/[0.08] flex flex-col gap-3">
                  <p className="text-xs text-navy/55">
                    {childCount > 0
                      ? `Tiene ${childCount} subcategoría${childCount === 1 ? "" : "s"} - muévelas o elimínalas primero.`
                      : directCount > 0
                        ? `Tiene ${directCount} movimiento${directCount === 1 ? "" : "s"} asociado${directCount === 1 ? "" : "s"} - al eliminarla, se quedarán sin categoría.`
                        : "¿Eliminar esta categoría?"}
                  </p>
                  <div className="flex items-center gap-3 justify-end">
                    <SecondaryButton onClick={() => setConfirmDelete(false)} disabled={isPending}>
                      Cancelar
                    </SecondaryButton>
                    <DangerButtonSolid onClick={handleDelete} disabled={isPending || childCount > 0}>
                      {isPending ? "Eliminando…" : "Eliminar"}
                    </DangerButtonSolid>
                  </div>
                </div>
              );
            })() : (
              <div className="px-5 py-4 border-t border-navy/[0.08] flex items-center gap-3">
                {editor.mode === "edit" ? (
                  <DeleteButton onClick={() => setConfirmDelete(true)} disabled={isPending} />
                ) : (
                  <SecondaryButton onClick={closeEditor} disabled={isPending}>
                    Cancelar
                  </SecondaryButton>
                )}
                <Button onClick={handleSave} disabled={isPending || !form.label.trim()} className="flex-1">
                  {isPending ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
