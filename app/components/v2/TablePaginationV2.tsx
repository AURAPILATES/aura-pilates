type Props = {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

/** Pie de paginación del rediseño en prueba — misma API que TablePagination.tsx. */
export default function TablePaginationV2({ page, totalItems, pageSize, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = totalItems === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min((safePage + 1) * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-1.5 py-3.5">
      <p className="text-[12.5px] text-[#a1a1aa]">
        {totalItems === 0 ? "Sin resultados" : `${start}–${end} de ${totalItems}`}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[#a1a1aa] hover:text-[#18181b] hover:bg-[#18181b]/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => onPageChange(i)}
              className={`w-7 h-7 flex items-center justify-center rounded-[8px] text-xs font-medium transition-colors ${
                i === safePage ? "bg-[#18181b] text-white" : "text-[#a1a1aa] hover:text-[#18181b] hover:bg-[#18181b]/[0.04]"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage === totalPages - 1}
            className="w-7 h-7 flex items-center justify-center rounded-[8px] text-[#a1a1aa] hover:text-[#18181b] hover:bg-[#18181b]/[0.04] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
