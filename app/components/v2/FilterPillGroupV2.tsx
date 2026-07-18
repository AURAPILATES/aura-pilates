type Option<T extends string> = { key: T; label: string; count?: number; countTone?: "warning" | "danger" };

type Props<T extends string> = {
  options: Option<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
};

/** Grupo de filtros rápidos segmentado (Todos / Recurrentes / …) del rediseño en prueba.
 * En pantallas estrechas, si no caben todas las opciones, hace scroll horizontal en vez
 * de partirse en varias filas. */
export default function FilterPillGroupV2<T extends string>({ options, active, onChange, className = "" }: Props<T>) {
  return (
    <div className={`overflow-x-auto scrollbar-none ${className}`}>
      <div className="inline-flex gap-0.5 bg-[#f6f6f7] rounded-[10px] p-[3px] w-max min-w-full sm:min-w-0">
        {options.map(({ key, label, count, countTone }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 px-3.5 py-[7px] rounded-[8px] text-[13px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              active === key ? "bg-[#18181b] text-white font-semibold" : "text-[#52525b] hover:text-[#18181b]"
            }`}
          >
            {label}
            {!!count && (
              <span
                className={`text-[11px] font-semibold rounded-[5px] px-1.5 ${
                  active === key
                    ? "bg-white text-[#b45309]"
                    : countTone === "danger"
                    ? "bg-[#fee2e2] text-[#dc2626]"
                    : "bg-[#fef3e2] text-[#b45309]"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
