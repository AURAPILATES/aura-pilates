type Option<T extends string> = { key: T; label: string; count?: number; countTone?: "warning" | "danger"; dot?: string };

type Props<T extends string> = {
  options: Option<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
  /** "dark": pastilla activa rellena de navy (uso original). "segmented": pastilla activa
   * blanca elevada sobre un track gris, como "Pestañas de sección · Segmentado" del mockup -
   * usado en Clientes, Horario, Contactos e Historial. */
  variant?: "dark" | "segmented";
};

/** Grupo de filtros rápidos segmentado (Todos / Recurrentes / …) del rediseño en prueba.
 * En pantallas estrechas, si no caben todas las opciones, hace scroll horizontal en vez
 * de partirse en varias filas. */
export default function FilterPillGroupV2<T extends string>({ options, active, onChange, className = "", variant = "dark" }: Props<T>) {
  const segmented = variant === "segmented";
  return (
    <div className={`overflow-x-auto scrollbar-none ${className}`}>
      <div className={`inline-flex items-center gap-0.5 rounded-[10px] p-[5px] w-max min-w-full sm:min-w-0 ${segmented ? "bg-navy/5" : "bg-subtle"}`}>
        {options.map(({ key, label, count, countTone, dot }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`shrink-0 flex items-center gap-1.5 whitespace-nowrap transition-colors p-[6px] ${
                segmented ? "text-[13px] rounded-[7px]" : "rounded-[8px] text-[13px] font-medium"
              } ${
                isActive
                  ? segmented
                    ? "bg-card text-navy font-medium border border-navy/[0.07]"
                    : "bg-navy text-app-bg font-semibold"
                  : segmented
                    ? "text-navy/50 hover:text-navy"
                    : "text-muted hover:text-navy"
              }`}
            >
              {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}
              {label}
              {!!count && (
                <span
                  className={`text-[11px] font-semibold rounded-[5px] px-1.5 ${
                    isActive && !segmented
                      ? "bg-card text-[#b45309] dark:text-[#e8a572]"
                      : countTone === "danger"
                      ? "bg-[#fee2e2] dark:bg-[#391313] text-[#dc2626] dark:text-[#dd7e7e]"
                      : "bg-[#fef3e2] dark:bg-[#392a13] text-[#b45309] dark:text-[#e8a572]"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
