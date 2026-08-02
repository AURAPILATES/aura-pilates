"use client";

export type SectionTabV2<T extends string> = {
  key: T;
  label: string;
  badge?: number;
};

type Props<T extends string> = {
  tabs: SectionTabV2<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
};

/** Subpestañas de sección del rediseño en prueba, estilo "carpeta": la pestaña activa es una
 * caja con esquinas superiores redondeadas cuyo borde inferior pinta encima de la línea
 * divisoria, dando la sensación de que se funde con el contenido de debajo. En pantallas
 * estrechas, si no caben todas, la fila hace scroll horizontal en vez de partirse en líneas. */
export default function SectionTabsV2<T extends string>({ tabs, active, onChange, className = "" }: Props<T>) {
  return (
    <div className={`overflow-x-auto scrollbar-none border-b border-border ${className}`}>
      <div className="flex gap-1 w-max min-w-full">
        {tabs.map(({ key, label, badge }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`relative -mb-px flex items-center gap-[7px] px-[15px] py-[9px] rounded-t-[9px] border text-[13.5px] whitespace-nowrap transition-colors shrink-0 ${
                isActive
                  ? "z-10 bg-card border-border border-b-card text-navy font-semibold"
                  : "border-transparent text-muted hover:text-navy"
              }`}
            >
              {label}
              {!!badge && (
                <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold px-1">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
