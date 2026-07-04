"use client";

export type SectionTab<T extends string> = {
  key: T;
  label: string;
  badge?: number;
};

type Props<T extends string> = {
  tabs: SectionTab<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
};

export default function SectionTabs<T extends string>({ tabs, active, onChange, className = "" }: Props<T>) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-1 border-b border-navy/[0.08] pb-2 ${className}`}>
      {tabs.map(({ key, label, badge }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`relative w-full sm:w-auto text-left whitespace-nowrap text-sm font-medium transition-colors rounded-lg ${
            active === key
              ? "text-navy bg-white border border-navy/[0.15]"
              : "text-navy/50 hover:text-navy"
          }`}
        >
          <span className="flex items-center gap-1.5 px-3 py-1.5">
            {label}
            {!!badge && (
              <span className="shrink-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-warning text-white text-[10px] font-bold px-1">
                {badge}
              </span>
            )}
          </span>
          {active === key && (
            <span className="hidden sm:block absolute -bottom-2.5 left-0 right-0 h-px bg-navy" />
          )}
        </button>
      ))}
    </div>
  );
}
