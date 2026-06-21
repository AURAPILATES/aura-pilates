"use client";

import type { ReactNode } from "react";
import DeltaBadge, { type DeltaDirection } from "./DeltaBadge";

export interface KpiTileDelta {
  cur: number;
  prev: number;
}

function pct(cur: number, prev: number): number {
  if (prev === 0) return 0;
  return ((cur - prev) / prev) * 100;
}

function deltaFromCurPrev(d: KpiTileDelta): { value: string; direction: DeltaDirection } | null {
  if (d.prev === 0) return null;
  const p = pct(d.cur, d.prev);
  if (p === 0) return null;
  return {
    value: `${p > 0 ? "+" : ""}${p.toFixed(1).replace(".", ",")} %`,
    direction: p > 0 ? "pos" : "neg",
  };
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center">
      <svg
        width="12" height="12" viewBox="0 0 16 16" fill="none"
        className="text-navy/30 hover:text-navy/55 transition-colors cursor-default shrink-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="4.5" r="0.75" fill="currentColor" />
      </svg>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] rounded-lg bg-navy px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 whitespace-normal text-center">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-navy" />
      </span>
    </span>
  );
}

export interface KpiTileProps {
  label: string;
  value: ReactNode;
  /** rango de fechas del período mostrado, ej. "12/03/26–11/04/26" */
  dateRange?: string;
  /** texto de ayuda al pasar el ratón sobre el label, para explicar cómo se calcula el KPI */
  tooltip?: string;
  /**
   * Comparativa vs período anterior. Pasa `{ cur, prev }` para que el % y la dirección
   * se calculen automáticamente, o un delta ya resuelto con `{ value, direction }`.
   */
  delta?: KpiTileDelta | { value: string; direction: DeltaDirection };
  /** etiqueta bajo el delta, ej. "01/02/26–28/02/26 · mes anterior" */
  compLabel?: string;
  /** texto de ayuda cuando NO hay delta (en su lugar de compLabel) */
  sub?: ReactNode;
  valueClassName?: string;
  accent?: "primary" | "success" | "warning" | "neutral";
  onClick?: () => void;
}

export default function KpiTile({
  label,
  value,
  dateRange,
  tooltip,
  delta,
  compLabel,
  sub,
  valueClassName = "text-navy",
  accent = "neutral",
  onClick,
}: KpiTileProps) {
  const resolvedDelta = delta
    ? "cur" in delta ? deltaFromCurPrev(delta) : delta
    : null;

  const hoverBorder = {
    primary: "hover:border-primary/30",
    success: "hover:border-success/30",
    warning: "hover:border-warning/40",
    neutral: "hover:border-navy/20",
  }[accent];

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={`bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-5 ${
        onClick ? `text-left transition-all group ${hoverBorder} hover:shadow-md` : ""
      }`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <p className="text-[11px] font-semibold text-navy/50 uppercase tracking-wider">{label}</p>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      {dateRange && <p className="text-[10px] text-navy/40 mb-1.5">{dateRange}</p>}

      <div className="flex items-baseline gap-2 flex-wrap">
        <p
          className={`text-2xl font-semibold tabular-nums ${valueClassName} ${
            onClick ? "group-hover:opacity-80 transition-opacity" : ""
          }`}
        >
          {value}
        </p>
        {resolvedDelta && <DeltaBadge value={resolvedDelta.value} direction={resolvedDelta.direction} />}
      </div>

      {(compLabel || sub) && (
        <p className="text-[10px] text-navy/40 mt-1.5 flex items-center gap-1">
          <span>{compLabel ?? sub}</span>
          {onClick && <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>}
        </p>
      )}
    </Wrapper>
  );
}
