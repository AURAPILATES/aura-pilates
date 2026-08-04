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
 * caja con esquinas superiores redondeadas y sin borde inferior propio (solo top/laterales);
 * al no ocupar ese lado, su fondo tapa la línea divisoria de debajo y da la sensación de que
 * se funde con el contenido. La línea divisoria vive en el div exterior, que no tiene padding
 * lateral propio - así llega a los bordes reales de la tarjeta cuando este componente se monta
 * dentro del header sticky (sin padding) en vez de en el contenido (con padding). La alineación
 * de las pestañas con el título de arriba viene del wrapper interno, que replica el mismo
 * max-w+padding que usa la cabecera. En pantallas estrechas, si no caben todas, la fila hace
 * scroll horizontal en vez de partirse en líneas. */
export default function SectionTabsV2<T extends string>({ tabs, active, onChange, className = "" }: Props<T>) {
  return (
    <div className={`border-b border-border ${className}`}>
      <div className="overflow-x-auto scrollbar-none max-w-[1600px] mx-auto px-4 sm:px-6">
        <div className="flex gap-1 w-max min-w-full">
          {tabs.map(({ key, label, badge }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                className={`relative -mb-px flex items-center gap-[7px] px-[15px] py-[9px] rounded-t-[9px] border-t border-x text-[13.5px] whitespace-nowrap transition-colors shrink-0 ${
                  isActive
                    ? "z-10 bg-card border-border text-navy font-semibold"
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
    </div>
  );
}
