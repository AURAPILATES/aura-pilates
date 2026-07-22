import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "react-feather";

export type DeltaDirection = "pos" | "neg" | "neu" | "warn";

const STYLES: Record<DeltaDirection, string> = {
  pos: "bg-success/10 text-success",
  neg: "bg-danger/10 text-danger",
  warn: "bg-warning/10 text-warning",
  neu: "bg-navy/5 text-navy/55",
};

const DEFAULT_ICON: Record<DeltaDirection, ReactNode> = {
  pos: <TrendingUp size={11} />,
  neg: <TrendingDown size={11} />,
  warn: null,
  neu: null,
};

export interface DeltaBadgeProps {
  value: string;
  direction: DeltaDirection;
  icon?: ReactNode | false;
  className?: string;
}

export default function DeltaBadge({ value, direction, icon, className = "" }: DeltaBadgeProps) {
  const shownIcon = icon === false ? null : icon ?? DEFAULT_ICON[direction];
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STYLES[direction]} ${className}`}
    >
      {shownIcon}
      {value}
    </span>
  );
}

/** % de variación entre el período actual y el anterior, listo para pasar a DeltaBadge.
 * `invert` es para métricas donde bajar es bueno (p.ej. plazas libres, errores de pago):
 * así el color refleja si es una buena o mala noticia, no solo si el número subió o bajó. */
export function pctDelta(cur: number, prev: number, invert = false): { value: string; direction: DeltaDirection } | undefined {
  if (!prev) return undefined;
  const p = ((cur - prev) / prev) * 100;
  if (p === 0) return undefined;
  const up = invert ? p < 0 : p > 0;
  return {
    value: `${p > 0 ? "+" : ""}${p.toFixed(1).replace(".", ",")}%`,
    direction: up ? "pos" : "neg",
  };
}
