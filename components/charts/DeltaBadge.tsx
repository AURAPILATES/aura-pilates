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
