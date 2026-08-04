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
  onNewCategory: () => void;
  onNewSubcategory: (parentId: string) => void;
  onEditCategory: (cat: Category) => void;
  onViewTransactions: (cat: Category) => void;
};

export default function CategoriasManagerV2({
  totalCategories, groups, totalCount, search, onSearchChange, draggedId, dragOverId,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
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
            {group.ordered.map((cat) => {
              const depth = depthOf(cat);
              const isSub = depth > 0;
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
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="var(--color-faint)" className="shrink-0 cursor-grab active:cursor-grabbing">
                    <circle cx="2.5" cy="3" r="1.3" /><circle cx="7.5" cy="3" r="1.3" />
                    <circle cx="2.5" cy="8" r="1.3" /><circle cx="7.5" cy="8" r="1.3" />
                    <circle cx="2.5" cy="13" r="1.3" /><circle cx="7.5" cy="13" r="1.3" />
                  </svg>
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
                    <button
                      onClick={(e) => { e.stopPropagation(); onNewSubcategory(cat.id); }}
                      title={`Añadir subcategoría a "${cat.label}"`}
                      className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{ backgroundColor: `${cat.text_color}1f`, color: cat.text_color }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
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
      <div className="pt-3.5 text-[12.5px] text-faint">{totalCategories} categorías · arrastra para reordenar</div>
    </div>
  );
}
