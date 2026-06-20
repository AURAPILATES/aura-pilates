"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Database, Zap } from "react-feather";
import DeltaBadge, { type DeltaDirection } from "./DeltaBadge";

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
}

export interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  dateRange?: string;
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
  dataSource?: ReactNode;
  className?: string;
}

export default function ChartCard({
  title,
  subtitle,
  dateRange,
  kpi,
  kpiItems,
  toolbar,
  children,
  chartDescription,
  aiInsight,
  aiInsightDefaultOpen = false,
  dataSource,
  className = "",
}: ChartCardProps) {
  const [aiOpen, setAiOpen] = useState(aiInsightDefaultOpen);

  return (
    <div className={`bg-white border border-navy/[0.07] rounded-2xl overflow-hidden shadow-card ${className}`}>
      {/* HEADER */}
      <div className="px-4 sm:px-5 pt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <span className="text-sm font-medium text-navy">{title}</span>
          {dateRange && (
            <span className="text-[11px] text-navy/50 bg-navy/5 px-2 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1">
              {dateRange}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-navy/50 leading-snug mb-2.5">{subtitle}</p>}
      </div>

      {/* KPI ÚNICO */}
      {kpi && (
        <div className="px-4 sm:px-5 pb-3 pt-1.5 border-b border-navy/[0.07]">
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
          className="grid border-b border-navy/[0.07]"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(110px, 1fr))` }}
        >
          {kpiItems.map((item, i) => (
            <div
              key={item.label}
              className={`px-4 sm:px-5 py-3 ${i < kpiItems.length - 1 ? "border-r border-navy/[0.07]" : ""}`}
            >
              <div className="text-[10px] uppercase tracking-wide text-navy/50 mb-1">{item.label}</div>
              <div className={`text-[22px] font-medium leading-tight text-navy ${item.valueClassName ?? ""}`}>
                {item.value}
              </div>
              {item.helper && <div className="text-[11px] text-navy/50 mt-0.5">{item.helper}</div>}
            </div>
          ))}
        </div>
      )}

      {/* TOOLBAR */}
      {toolbar && (
        <div className="flex items-center justify-between gap-2 flex-wrap px-4 sm:px-5 py-2.5 border-b border-navy/[0.07]">
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
        <div className="bg-primary/5 border-t border-navy/[0.07] px-4 sm:px-5 py-3">
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
      {dataSource && (
        <div className="flex items-start gap-1.5 text-[11px] text-navy/45 leading-relaxed px-4 sm:px-5 py-2.5 border-t border-navy/[0.07]">
          <Database size={13} className="shrink-0 mt-px" />
          {dataSource}
        </div>
      )}
    </div>
  );
}

/* ── Helpers de toolbar reutilizables por las instancias ────────────────── */

export interface ToggleOption {
  value: string;
  label: string;
}

export interface ToggleGroupProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ToggleGroup({ options, value, onChange, className = "" }: ToggleGroupProps) {
  return (
    <div className={`flex gap-0.5 bg-navy/5 p-[3px] rounded-[10px] ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 text-xs rounded-[7px] whitespace-nowrap transition-colors ${
            opt.value === value
              ? "bg-white text-navy font-medium border border-navy/[0.07] shadow-card"
              : "text-navy/50 hover:text-navy"
          }`}
        >
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
    <div className={`flex ${className}`}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-label={opt.label}
          aria-pressed={opt.value === value}
          className={`w-[30px] h-7 flex items-center justify-center border border-navy/[0.07] ${
            i === 0 ? "rounded-l-[7px]" : "-ml-px"
          } ${i === options.length - 1 ? "rounded-r-[7px]" : ""} ${
            opt.value === value ? "bg-navy text-white border-navy" : "bg-navy/5 text-navy/50"
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
