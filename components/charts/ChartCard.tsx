"use client";

import { useState, useRef, type ReactNode } from "react";
import { Book, ChevronDown, Eye, EyeOff, Zap } from "react-feather";
import DeltaBadge, { type DeltaDirection } from "./DeltaBadge";
import { SOURCE_LABELS, type SourceKey } from "../icons/SourceIcons";

export interface SingleKpi {
  value: string;
  valueClassName?: string;
  delta?: { value: string; direction: DeltaDirection };
  comparison?: ReactNode;
}

export interface MultiKpiItem {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  helper?: ReactNode;
  tooltip?: string;
  onClick?: () => void;
  /** Badge de variación vs. el período de comparación (ver pctDelta en DeltaBadge.tsx). */
  delta?: { value: string; direction: DeltaDirection };
}

export interface ChartCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  dateRange?: string;
  /** Acción a la derecha del título (p.ej. un botón "Editar"), en vez de en la fila de toolbar. */
  headerAction?: ReactNode;
  /** KPI único con badge de delta — usar en lugar de `kpiItems`, no junto a él */
  kpi?: SingleKpi;
  /** grid de mini-KPIs — usar en lugar de `kpi`, no junto a él */
  kpiItems?: MultiKpiItem[];
  toolbar?: ReactNode;
  children?: ReactNode;
  /** descripción accesible del gráfico, para lectores de pantalla (no oculta el contenido real del gráfico) */
  chartDescription?: string;
  aiInsight?: ReactNode;
  aiInsightDefaultOpen?: boolean;
  /** detalle/metodología de la fuente — no se muestra en línea, aparece como tooltip al pasar el ratón */
  dataSource?: string;
  sources?: SourceKey[];
  /** texto ya formateado, p.ej. "ahora" / "hace 3 min" / "hoy 8:30" / "11 jun 2026" */
  lastUpdated?: string | null;
  className?: string;
}

export default function ChartCard({
  title,
  subtitle,
  dateRange,
  headerAction,
  kpi,
  kpiItems,
  toolbar,
  children,
  chartDescription,
  aiInsight,
  aiInsightDefaultOpen = false,
  dataSource,
  sources,
  lastUpdated,
  className = "",
}: ChartCardProps) {
  const [aiOpen, setAiOpen] = useState(aiInsightDefaultOpen);
  const [tooltip, setTooltip] = useState<{ text: string; top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  function showTooltip(e: { currentTarget: HTMLElement }, text: string) {
    const iconRect = e.currentTarget.getBoundingClientRect();
    const cardRect = cardRef.current?.getBoundingClientRect();
    if (!cardRect) return;
    const maxLeft = (typeof window !== "undefined" ? window.innerWidth : iconRect.left + 216) - 216;
    setTooltip({ text, top: cardRect.top - 8, left: Math.max(8, Math.min(iconRect.left, maxLeft)) });
  }

  return (
    <div ref={cardRef} className={`relative bg-card border border-border rounded-[14px] overflow-hidden flex flex-col ${className}`}>
      {/* HEADER */}
      <div className="px-4 sm:px-5 pt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <span className="flex items-center gap-1 text-sm font-medium text-navy">
            {title}
            {dataSource && (
              <span
                className="shrink-0"
                onMouseEnter={(e) => showTooltip(e, dataSource)}
                onMouseLeave={() => setTooltip(null)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy/35 cursor-help">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </span>
            )}
          </span>
          {(dateRange || headerAction) && (
            <span className="flex items-center gap-2 shrink-0">
              {dateRange && (
                <span className="text-[11px] text-navy/50 bg-navy/5 px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1">
                  {dateRange}
                </span>
              )}
              {headerAction}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-navy/50 leading-snug mb-2.5">{subtitle}</p>}
      </div>

      {/* KPI ÚNICO */}
      {kpi && (
        <div className="px-4 sm:px-5 pb-3 pt-1.5 border-b border-border">
          <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
            <span className={`text-[32px] font-medium text-navy tracking-tight leading-none ${kpi.valueClassName ?? ""}`}>
              {kpi.value}
            </span>
            {kpi.delta && <DeltaBadge value={kpi.delta.value} direction={kpi.delta.direction} />}
          </div>
          {kpi.comparison && <div className="text-xs text-navy/50">{kpi.comparison}</div>}
        </div>
      )}

      {/* KPI MULTI */}
      {kpiItems && kpiItems.length > 0 && (
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(110px, 1fr))` }}
        >
          {kpiItems.map((item, i) => {
            const Cell = item.onClick ? "button" : "div";
            return (
              <Cell
                key={item.label}
                onClick={item.onClick}
                className={`px-4 sm:px-5 py-3 text-left ${i < kpiItems.length - 1 ? "border-r border-border" : ""} ${
                  item.onClick ? "hover:bg-navy/[0.02] transition-colors cursor-pointer" : ""
                }`}
              >
                <div className="text-[11px] text-navy/50 mb-1 flex items-center gap-1">
                  {item.label}
                  {item.tooltip && (
                    <span
                      className="shrink-0"
                      onMouseEnter={(e) => showTooltip(e, item.tooltip!)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy/35 cursor-help">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-2xl font-medium leading-tight text-navy ${item.valueClassName ?? ""}`}>
                    {item.value}
                  </span>
                  {item.delta && <DeltaBadge value={item.delta.value} direction={item.delta.direction} />}
                </div>
                {item.helper && <div className="text-[11px] text-navy/45 mt-0.5">{item.helper}</div>}
              </Cell>
            );
          })}
        </div>
      )}

      {/* TOOLBAR */}
      {toolbar && (
        <div className="flex items-center justify-between gap-2 flex-wrap px-4 sm:px-5 py-2.5 border-b border-border">
          {toolbar}
        </div>
      )}

      {/* CHART AREA */}
      {children && (
        <div className="px-4 sm:px-5 py-4">
          {chartDescription && <p className="sr-only">{chartDescription}</p>}
          {children}
        </div>
      )}

      {/* AI INSIGHT */}
      {aiInsight && (
        <div className="bg-primary/5 border-t border-border px-4 sm:px-5 py-3">
          <button
            type="button"
            onClick={() => setAiOpen((o) => !o)}
            aria-expanded={aiOpen}
            className="flex items-center gap-1.5 text-xs font-medium text-primary w-full"
          >
            <Zap size={14} />
            Análisis IA
            <ChevronDown
              size={13}
              className={`ml-auto transition-transform ${aiOpen ? "rotate-180" : ""}`}
            />
          </button>
          {aiOpen && <div className="text-xs text-navy/60 leading-relaxed mt-2">{aiInsight}</div>}
        </div>
      )}

      {/* SOURCE */}
      {((sources && sources.length > 0) || lastUpdated) && (
        <div className="mt-auto flex items-center justify-between flex-wrap gap-x-3 gap-y-1 text-[11px] text-navy/45 leading-relaxed px-4 sm:px-5 py-2.5 border-t border-border">
          {sources && sources.length > 0 ? (
            <span className="flex items-center gap-1.5 min-w-0" title={dataSource || undefined}>
              <Book size={13} className="shrink-0" />
              <span className="truncate">Fuentes de datos: {sources.map((s) => SOURCE_LABELS[s]).join(", ")}</span>
            </span>
          ) : (
            <span />
          )}
          {lastUpdated && <span className="shrink-0 whitespace-nowrap">Última actualización: {lastUpdated}</span>}
        </div>
      )}

      {/* Tooltip de kpiItems: posición fija por encima de toda la caja (no del icono), para
          que nunca tape el título/subtítulo de la propia card */}
      {tooltip && (
        <div
          className="fixed z-50 w-52 -translate-y-full bg-navy-solid text-white text-[11px] leading-relaxed rounded-xl px-3 py-2.5 shadow-xl normal-case tracking-normal font-normal pointer-events-none"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.text}
          <div className="absolute top-full left-3 border-4 border-transparent border-t-navy" />
        </div>
      )}
    </div>
  );
}

/* ── Helpers de toolbar reutilizables por las instancias ────────────────── */

export interface ToggleOption {
  value: string;
  label: string;
  /** Icono opcional junto al texto (mismo tamaño/color en todos los toggles). */
  icon?: ReactNode;
  /** Clase para el estado activo; sobreescribe el estilo navy/blanco por defecto (p.ej. acento semántico verde/rojo). */
  activeClassName?: string;
}

export interface ToggleGroupProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Los botones se reparten a partes iguales el ancho del contenedor (p.ej. toggles de formulario). */
  fullWidth?: boolean;
}

export function ToggleGroup({ options, value, onChange, className = "", fullWidth = false }: ToggleGroupProps) {
  return (
    <div className={`flex gap-0.5 bg-navy/5 p-[3px] rounded-[10px] ${fullWidth ? "w-full" : ""} ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs rounded-[7px] whitespace-nowrap transition-colors ${fullWidth ? "flex-1" : ""} ${
            opt.value === value
              ? opt.activeClassName ?? "bg-card text-navy font-medium border border-navy/[0.07] shadow-card"
              : "text-navy/50 hover:text-navy"
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export interface IconToggleOption {
  value: string;
  label: string;
  icon: ReactNode;
}

export interface ChartTypeToggleProps {
  options: IconToggleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ChartTypeToggle({ options, value, onChange, className = "" }: ChartTypeToggleProps) {
  return (
    <div className={`flex gap-0.5 bg-navy/5 p-[3px] rounded-[10px] ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-label={opt.label}
          aria-pressed={opt.value === value}
          className={`w-7 h-[26px] flex items-center justify-center rounded-[7px] transition-colors ${
            opt.value === value
              ? "bg-card text-navy border border-navy/[0.07] shadow-card"
              : "text-navy/50 hover:text-navy"
          }`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

export interface LegendItem {
  label: string;
  color: string;
}

export function Legend({ items, className = "" }: { items: LegendItem[]; className?: string }) {
  return (
    <div className={`flex gap-3 flex-wrap ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs text-navy/55">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

/** Leyenda estática (sin estado, sin drawer): solo explica qué significa cada color/trazo
 * del gráfico. No confundir con InteractiveLegend, que sí permite ocultar series y abrir detalle. */
export interface StaticLegendItem {
  label: string;
  color: string;
  swatch?: "dot" | "line" | "dashed";
}

export function StaticLegend({ items, className = "" }: { items: StaticLegendItem[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-navy/60 ${className}`}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {item.swatch === "dot" ? (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          ) : (
            <svg width="14" height="8" className="shrink-0" aria-hidden="true">
              <line
                x1="0" y1="4" x2="14" y2="4"
                stroke={item.color}
                strokeWidth="2"
                strokeDasharray={item.swatch === "dashed" ? "3 2" : undefined}
              />
            </svg>
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Leyenda interactiva estándar: clic en la etiqueta abre el detalle (drawer) de ese
 * dato; el icono de ojo muestra/oculta esa serie en el gráfico sin alterar los totales. */
export interface InteractiveLegendItem {
  key: string;
  label: string;
  color: string;
  value?: ReactNode;
  helper?: ReactNode;
  hidden?: boolean;
}

export function InteractiveLegend({
  items,
  onSelect,
  onToggleVisibility,
  className = "",
}: {
  items: InteractiveLegendItem[];
  onSelect?: (key: string) => void;
  onToggleVisibility?: (key: string) => void;
  className?: string;
}) {
  // Con pocas series sobra espacio vertical para una columna a tamaño normal; con muchas,
  // compactamos a 2 columnas y texto más pequeño para que quepan en el mismo alto. Las 2
  // columnas solo se activan si el propio contenedor tiene sitio real (container query) —
  // en un panel lateral estrecho (25%) 2 columnas no caben y se queda en 1 compacta.
  const compact = items.length > 3;

  return (
    <div className={`@container ${className}`}>
      <div className={compact ? "grid grid-cols-1 @[360px]:grid-cols-2 gap-x-4" : "space-y-0.5"}>
      {items.map((item) => (
        <div
          key={item.key}
          className={`flex items-center gap-1.5 rounded-lg transition-colors -mx-2 ${compact ? "px-1.5 py-1" : "px-2 py-1.5"} ${
            item.hidden ? "opacity-40" : "hover:bg-navy/[0.02]"
          }`}
        >
          <button
            type="button"
            onClick={() => onSelect?.(item.key)}
            className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
            title={onSelect ? "Ver transacciones" : undefined}
          >
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
            <span
              title={item.label}
              className={`font-medium text-navy truncate ${compact ? "text-[12px]" : "text-[13px]"} ${item.hidden ? "line-through" : ""}`}
            >
              {item.label}
            </span>
          </button>
          {item.value !== undefined && (
            <span
              className={`font-semibold text-navy tabular-nums text-right shrink-0 ${compact ? "text-[12px]" : "text-[13px]"}`}
            >
              {item.value}
            </span>
          )}
          {item.helper !== undefined && (
            <span className={`text-navy/50 tabular-nums text-right shrink-0 ${compact ? "text-[11px]" : "text-xs"}`}>
              {item.helper}
            </span>
          )}
          {onToggleVisibility && (
            <button
              type="button"
              onClick={() => onToggleVisibility(item.key)}
              aria-pressed={!item.hidden}
              title={item.hidden ? "Mostrar en el gráfico" : "Ocultar en el gráfico"}
              className="shrink-0 p-1 rounded-full text-navy/35 hover:text-navy hover:bg-navy/[0.06] transition-colors"
            >
              {item.hidden ? <EyeOff size={compact ? 11 : 12} /> : <Eye size={compact ? 11 : 12} />}
            </button>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
