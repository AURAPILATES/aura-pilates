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
  const diff = cur - prev;
  if (diff === 0) return undefined;
  // El color/dirección sale del signo de la diferencia real, no del signo del %: con `prev`
  // negativo (p.ej. margen de -100€ a +50€, una mejora real) el % da negativo aunque haya
  // mejorado - calcular "up" a partir de `diff` evita pintar una mejora como si fuera peor.
  const up = invert ? diff < 0 : diff > 0;
  const p = (diff / Math.abs(prev)) * 100;
  // Con `prev` cercano a cero el % no tiene tope y sale un número que no comunica nada
  // (tipo "+49990%") - a partir de ±999% mostramos el tope en vez del valor literal.
  const capped = Math.abs(p) > 999;
  const shownNum = (capped ? 999 : Math.abs(p)).toFixed(1).replace(".", ",");
  const value = capped
    ? (p >= 0 ? `>${shownNum}%` : `<-${shownNum}%`)
    : `${p >= 0 ? "+" : "-"}${shownNum}%`;
  return { value, direction: up ? "pos" : "neg" };
}
