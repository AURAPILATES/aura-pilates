export type RunwayTone = "success" | "warning" | "danger";

const TONE_FILL: Record<RunwayTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export interface RunwayDotsProps {
  /** número total de segmentos a representar (p. ej. 6 meses) */
  segments: number;
  /** valor real, puede ser fraccional (p. ej. 3.5) */
  value: number;
  tone?: RunwayTone;
  className?: string;
}

export default function RunwayDots({ segments, value, tone = "warning", className = "" }: RunwayDotsProps) {
  const fullDots = Math.min(Math.floor(value), segments);
  const fraction = value > fullDots ? Math.min(value - fullDots, 1) : 0;

  return (
    <div className={`flex gap-[3px] ${className}`} role="img" aria-label={`${value} de ${segments} unidades`}>
      {Array.from({ length: segments }).map((_, i) => {
        const isFull = i < fullDots;
        const isPartial = !isFull && i === fullDots && fraction > 0;
        return (
          <span
            key={i}
            className="relative w-4 h-1.5 rounded-sm overflow-hidden bg-navy/[0.06] border border-navy/[0.06]"
          >
            {isFull && <span className={`absolute inset-0 ${TONE_FILL[tone]}`} />}
            {isPartial && (
              <span
                className={`absolute inset-y-0 left-0 ${TONE_FILL[tone]}`}
                style={{ width: `${fraction * 100}%` }}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
