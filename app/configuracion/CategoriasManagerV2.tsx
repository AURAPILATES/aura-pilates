import type { Category } from "@/lib/categories";
import { CategoryIcon } from "./CategoriasManager";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import { PrimaryButtonV2 } from "@/app/components/v2/ButtonsV2";

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
  onEditCategory: (cat: Category) => void;
  onViewTransactions: (cat: Category) => void;
};

export default function CategoriasManagerV2({
  totalCategories, groups, totalCount, search, onSearchChange, draggedId, dragOverId,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  onNewCategory, onEditCategory, onViewTransactions,
}: Props) {
  return (
    <div>
      <div className="flex items-center gap-[10px]">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar categoría…" className="flex-1 min-w-[160px]" />
        <PrimaryButtonV2
          onClick={onNewCategory}
          label="Nueva categoría"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
        />
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
              const isSub = !!cat.parent_id;
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
                  style={{ paddingLeft: isSub ? 28 : 0 }}
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="#d4d4d8" className="shrink-0 cursor-grab active:cursor-grabbing">
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
                  <span className="text-[12.5px] text-faint whitespace-nowrap shrink-0">{totalCount(cat)} trx</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewTransactions(cat); }}
                    title={`Ver movimientos de "${cat.label}"`}
                    className="shrink-0 text-border hover:text-muted transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-3.8-3.8" /></svg>
                  </button>
                  <span className="shrink-0 text-border">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                  </span>
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
