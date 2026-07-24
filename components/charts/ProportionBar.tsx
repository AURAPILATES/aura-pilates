export interface ProportionSegment {
  label: string;
  /** color hex/rgb dinámico de la serie - ver convención de color por categoría en app/finanzas */
  color: string;
  percentage: number;
  /** valor ya formateado para mostrar en la leyenda (p. ej. "5.860 €") */
  displayValue?: string;
}

export interface ProportionBarProps {
  segments: ProportionSegment[];
  className?: string;
}

export default function ProportionBar({ segments, className = "" }: ProportionBarProps) {
  return (
    <div className={className}>
      <div className="h-2.5 rounded-full overflow-hidden flex mb-2 bg-navy/[0.05]">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${s.percentage}%`, backgroundColor: s.color }}
            title={`${s.label} · ${s.percentage}%`}
          />
        ))}
      </div>
      <div className="flex gap-4 flex-wrap">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-navy/55">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
            <b className="text-navy font-medium">{s.percentage}%</b>
            {s.displayValue && <span className="text-navy/40">({s.displayValue})</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
