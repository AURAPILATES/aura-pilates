import { useState } from "react";
import type { Category } from "@/lib/categories";
import { CategoryIcon } from "./CategoriasManager";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import { PrimaryButtonV2 } from "@/app/components/v2/ButtonsV2";
import HeaderPortal from "@/app/components/HeaderPortal";

type DisplayGroup = { sectionLabel?: string; subsectionLabel?: string; ordered: Category[] };

type Props = {
  totalCategories: number;
  groups: DisplayGroup[];
  totalCount: (cat: Category) => number;
  search: string;
  onSearchChange: (v: string) => void;
  draggedId: string | null;
  dragOverId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDragLeave: (id: string) => void;
  onDrop: (list: Category[], targetId: string) => void;
  onDragEnd: () => void;
  onMoveStep: (list: Category[], id: string, direction: -1 | 1) => void;
  onNewCategory: () => void;
  onNewSubcategory: (parentId: string) => void;
  onEditCategory: (cat: Category) => void;
  onViewTransactions: (cat: Category) => void;
};

export default function CategoriasManagerV2({
  totalCategories, groups, totalCount, search, onSearchChange, draggedId, dragOverId,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, onMoveStep,
  onNewCategory, onNewSubcategory, onEditCategory, onViewTransactions,
}: Props) {
  // Profundidad de cada categoría (0 = raíz) para indentar los niveles anidados. Se calcula
  // sobre todas las categorías visibles; si un ancestro no está presente (búsqueda filtrada),
  // el recorrido se detiene y la indentación se acorta, sin romperse.
  const byId = new Map(groups.flatMap((g) => g.ordered).map((c) => [c.id, c]));
  function depthOf(cat: Category): number {
    let d = 0;
    let cur: Category | undefined = cat;
    const seen = new Set<string>();
    while (cur?.parent_id && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parent_id);
      if (cur) d++;
    }
    return d;
  }

  // Colapsar ramas: con jerarquías de hasta 3 niveles y creciendo, mostrar siempre todo
  // expandido solo puede alargar la lista con el tiempo, sin forma de aparcar una rama que no
  // interesa en ese momento. Estado de solo sesión (no persiste entre recargas) a propósito -
  // es una ayuda de lectura puntual, no una preferencia que valga la pena guardar en BD.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const childCountById = new Map<string, number>();
  for (const c of byId.values()) {
    if (c.parent_id) childCountById.set(c.parent_id, (childCountById.get(c.parent_id) ?? 0) + 1);
  }
  function isHiddenByCollapsedAncestor(cat: Category): boolean {
    let cur = cat.parent_id ? byId.get(cat.parent_id) : undefined;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      if (collapsed.has(cur.id)) return true;
      seen.add(cur.id);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return false;
  }
  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center gap-[10px]">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar categoría…" className="flex-1 min-w-[160px]" />
        <HeaderPortal>
          <PrimaryButtonV2
            onClick={onNewCategory}
            label="Nueva categoría"
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
          />
        </HeaderPortal>
      </div>

      <div className="mt-[14px]">
        {groups.length === 0 && (
          <div className="py-12 text-center text-faint text-sm">Ninguna categoría coincide con la búsqueda.</div>
        )}
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.sectionLabel && (
              <p className="pt-[18px] pb-1.5 text-[11px] tracking-wide uppercase text-faint font-bold">{group.sectionLabel}</p>
            )}
            {group.subsectionLabel && (
              <p className="pt-2.5 pb-1 text-[11.5px] text-faint font-medium">{group.subsectionLabel}</p>
            )}
            {group.ordered.map((cat, idx) => {
              if (isHiddenByCollapsedAncestor(cat)) return null;
              const depth = depthOf(cat);
              const isSub = depth > 0;
              const childCount = childCountById.get(cat.id) ?? 0;
              const isCollapsed = collapsed.has(cat.id);
              const isDragging = draggedId === cat.id;
              const isDragOver = dragOverId === cat.id && draggedId !== null && draggedId !== cat.id;
              return (
                <div
                  key={cat.id}
                  draggable
                  onDragStart={() => onDragStart(cat.id)}
                  onDragOver={(e) => { e.preventDefault(); onDragOver(cat.id); }}
                  onDragLeave={() => onDragLeave(cat.id)}
                  onDrop={(e) => { e.preventDefault(); onDrop(group.ordered, cat.id); }}
                  onDragEnd={onDragEnd}
                  className={`flex items-center gap-3 border-t border-subtle py-[9px] transition-colors ${
                    isDragOver ? "bg-navy/[0.04]" : ""
                  } ${isDragging ? "opacity-40" : ""}`}
                  style={{ paddingLeft: depth * 28 }}
                >
                  {/* Escritorio: asa de arrastrar (drag-and-drop nativo, sin soporte táctil). En
                      móvil se sustituye por flechas subir/bajar, que sí funcionan con el dedo. */}
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="var(--color-faint)" className="hidden sm:block shrink-0 cursor-grab active:cursor-grabbing">
                    <circle cx="2.5" cy="3" r="1.3" /><circle cx="7.5" cy="3" r="1.3" />
                    <circle cx="2.5" cy="8" r="1.3" /><circle cx="7.5" cy="8" r="1.3" />
                    <circle cx="2.5" cy="13" r="1.3" /><circle cx="7.5" cy="13" r="1.3" />
                  </svg>
                  <div className="flex sm:hidden flex-col shrink-0 -my-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onMoveStep(group.ordered, cat.id, -1); }}
                      disabled={idx === 0}
                      title="Subir"
                      className="w-5 h-4 flex items-center justify-center text-faint disabled:opacity-20"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onMoveStep(group.ordered, cat.id, 1); }}
                      disabled={idx === group.ordered.length - 1}
                      title="Bajar"
                      className="w-5 h-4 flex items-center justify-center text-faint disabled:opacity-20"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                  </div>
                  {childCount > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleCollapse(cat.id); }}
                      title={isCollapsed ? `Mostrar ${childCount} subcategorías` : "Plegar subcategorías"}
                      className="shrink-0 w-5 h-5 flex items-center justify-center text-faint hover:text-muted transition-colors"
                    >
                      <svg
                        width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className={`transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  ) : (
                    <span className="shrink-0 w-5 h-5" />
                  )}
                  <button
                    onClick={() => onEditCategory(cat)}
                    className="flex-1 flex items-center gap-3 min-w-0 text-left"
                  >
                    <CategoryIcon iconKey={cat.emoji} name={cat.label} color={cat.text_color} size={isSub ? 28 : 30} />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-navy truncate">{cat.label}</p>
                      {cat.auto_keywords && <p className="text-[11.5px] text-faint truncate">{cat.auto_keywords}</p>}
                    </div>
                  </button>
                  {depth === 0 && (
                    // Un círculo relleno del color de la categoría seguía leyendo como
                    // insignia (en esta app los círculos de color SIEMPRE son identidad -
                    // icono de categoría, avatar - nunca un botón). Los botones reales de la
                    // app (IconButtonV2 y similares) son rectángulos redondeados con fondo
                    // neutro y borde - ese cambio de forma, no solo de borde, es lo que lo
                    // separa del resto de círculos de la fila.
                    <button
                      onClick={(e) => { e.stopPropagation(); onNewSubcategory(cat.id); }}
                      title={`Añadir subcategoría a "${cat.label}"`}
                      className="shrink-0 w-6 h-6 rounded-[7px] flex items-center justify-center border border-border bg-card text-muted hover:text-navy hover:border-navy/25 hover:bg-navy/[0.03] transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  )}
                  <span className="text-[12.5px] text-faint whitespace-nowrap shrink-0">{totalCount(cat)} trx</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewTransactions(cat); }}
                    title={`Ver movimientos de "${cat.label}"`}
                    className="shrink-0 text-border hover:text-muted transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-3.8-3.8" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="pt-3.5 text-[12.5px] text-faint">
        {totalCategories} categorías ·{" "}
        <span className="hidden sm:inline">arrastra para reordenar</span>
        <span className="sm:hidden">usa las flechas para reordenar</span>
      </div>
    </div>
  );
}
