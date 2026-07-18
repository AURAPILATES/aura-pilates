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

/** Subpestañas de sección del rediseño en prueba: subrayado 2px, sin caja. En pantallas
 * estrechas, si no caben todas, la fila hace scroll horizontal en vez de partirse en líneas. */
export default function SectionTabsV2<T extends string>({ tabs, active, onChange, className = "" }: Props<T>) {
  return (
    <div className={`overflow-x-auto scrollbar-none border-b border-[#eee] ${className}`}>
      <div className="flex gap-5 sm:gap-[22px] w-max min-w-full">
        {tabs.map(({ key, label, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex items-center gap-[7px] pb-[11px] text-[14px] whitespace-nowrap transition-colors -mb-px shrink-0 ${
              active === key
                ? "text-[#18181b] font-semibold border-b-2 border-[#18181b]"
                : "text-[#71717a] border-b-2 border-transparent hover:text-[#18181b]"
            }`}
          >
            {label}
            {!!badge && (
              <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[#b45309] text-white text-[11px] font-semibold px-1">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
