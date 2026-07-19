"use client";

import { useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine,
  type TooltipContentProps,
} from "recharts";
import type { BusinessEvent, EventCategoria } from "@/lib/businessEvents";

export type EvolucionRow = { month: string; label: string; [key: string]: string | number };

const EVENT_COLORS: Record<EventCategoria, string> = {
  precios: "#F59E0B",
  horarios: "#3B82F6",
  promociones: "#10B981",
  operativo: "#A855F7",
  otro: "#64748B",
};

const EVENT_LABELS: Record<EventCategoria, string> = {
  precios: "Precios",
  horarios: "Horarios",
  promociones: "Promociones",
  operativo: "Operativo",
  otro: "Otro",
};

const MONTH_NAMES: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

function fmtEventDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTH_NAMES[m]} ${y}`;
}

function fmtTick(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;
}

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

function makeTooltip(keys: string[], colorOf: (k: string) => string) {
  return function EvolucionTooltip({ active, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as EvolucionRow;
    return (
      <div className="bg-white border border-[#e6e6ea] rounded-[10px] shadow-lg px-3 py-2 text-xs min-w-[160px]">
        <p className="font-semibold text-navy mb-1.5">{row.label}</p>
        {keys.map((k) => (
          <div key={k} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorOf(k) }} />
            <span className="text-navy/55 truncate">{k}</span>
            <span className="font-semibold text-navy ml-auto whitespace-nowrap">{fmtEur(Number(row[k] ?? 0))}</span>
          </div>
        ))}
      </div>
    );
  };
}

interface EventDotProps {
  viewBox?: { x?: number; y?: number };
  evs: BusinessEvent[];
  hoveredEventId: string | null;
  onHover: (id: string | null) => void;
}

function EventDots({ viewBox, evs, hoveredEventId, onHover }: EventDotProps) {
  if (!viewBox?.x || !viewBox?.y) return null;
  return (
    <>
      {evs.map((ev, ei) => {
        const cx = viewBox.x! + (evs.length > 1 ? (ei - (evs.length - 1) / 2) * 7 : 0);
        const isHov = hoveredEventId === ev.id;
        return (
          <g key={ev.id} style={{ cursor: "default" }} onMouseEnter={() => onHover(ev.id)} onMouseLeave={() => onHover(null)}>
            <circle cx={cx} cy={viewBox.y} r={isHov ? 5 : 3.5} fill={EVENT_COLORS[ev.categoria]} stroke="white" strokeWidth={isHov ? 1.5 : 1} />
            {isHov && (
              <g pointerEvents="none">
                <rect x={cx + 8} y={viewBox.y! - 8} width={210} height={ev.descripcion ? 68 : 50} rx="10"
                  fill="white" stroke="#e6e6ea" style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.12))" }} />
                <circle cx={cx + 24} cy={viewBox.y! + 12} r="4" fill={EVENT_COLORS[ev.categoria]} />
                <text x={cx + 33} y={viewBox.y! + 16} fontSize="12" fontWeight="600" fill={EVENT_COLORS[ev.categoria]}>
                  {EVENT_LABELS[ev.categoria]}
                </text>
                <text x={cx + 210} y={viewBox.y! + 16} fontSize="11.5" fill="#a1a1aa" textAnchor="end">
                  {fmtEventDate(ev.fecha)}
                </text>
                <text x={cx + 18} y={viewBox.y! + 34} fontSize="13" fontWeight="600" fill="#18181b">
                  {ev.titulo.length > 26 ? ev.titulo.slice(0, 26) + "…" : ev.titulo}
                </text>
                {ev.descripcion && (
                  <text x={cx + 18} y={viewBox.y! + 51} fontSize="11.5" fill="#71717a">
                    {ev.descripcion.length > 32 ? ev.descripcion.slice(0, 32) + "…" : ev.descripcion}
                  </text>
                )}
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}

export default function EvolucionIngresosBody({
  rows,
  keys,
  hiddenKeys,
  hoveredLegendKey,
  chartType,
  view,
  colorOf,
  eventsByMonth,
  onBarClick,
  height = 340,
}: {
  rows: EvolucionRow[];
  keys: string[];
  hiddenKeys: Set<string>;
  hoveredLegendKey: string | null;
  chartType: "line" | "bar";
  view: "procedencia" | "producto";
  colorOf: (key: string) => string;
  eventsByMonth: Map<string, BusinessEvent[]>;
  onBarClick?: (month: string, key: string) => void;
  height?: number;
}) {
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const visibleKeys = keys.filter((k) => !hiddenKeys.has(k));

  if (rows.length === 0) {
    return <p className="text-sm text-navy/45 text-center py-10">Sin datos de ventas</p>;
  }

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barGap={2}>
          {view === "procedencia" && (
            <defs>
              {visibleKeys.map((key) => (
                <linearGradient key={`grad-${key}`} id={`grad-${key.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorOf(key)} stopOpacity={hoveredLegendKey !== null && hoveredLegendKey !== key ? 0.03 : 0.22} />
                  <stop offset="100%" stopColor={colorOf(key)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
          )}
          <CartesianGrid strokeDasharray="4 3" stroke="rgba(28,25,23,0.07)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtTick} tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} width={34} />
          <Tooltip content={makeTooltip(visibleKeys, colorOf)} cursor={chartType === "bar" ? { fill: "rgba(28,25,23,0.04)" } : { stroke: "rgba(28,25,23,0.2)", strokeDasharray: "4 3" }} />

          {rows.map((r) => {
            const evs = eventsByMonth.get(r.month) ?? [];
            if (evs.length === 0) return null;
            return (
              <ReferenceLine
                key={`evline-${r.month}`}
                x={r.label}
                stroke={EVENT_COLORS[evs[0].categoria]}
                strokeDasharray="3 3"
                strokeOpacity={0.4}
                label={(props: { viewBox?: { x?: number; y?: number } }) => (
                  <EventDots viewBox={props.viewBox} evs={evs} hoveredEventId={hoveredEventId} onHover={setHoveredEventId} />
                )}
              />
            );
          })}

          {chartType === "bar" &&
            visibleKeys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colorOf(key)}
                radius={[2, 2, 0, 0]}
                opacity={hoveredLegendKey !== null && hoveredLegendKey !== key ? 0.3 : 1}
                cursor={view === "producto" && onBarClick ? "pointer" : undefined}
                onClick={
                  view === "producto" && onBarClick
                    ? (data: { payload?: EvolucionRow }) => {
                        if (data.payload) onBarClick(data.payload.month, key);
                      }
                    : undefined
                }
              />
            ))}
          {chartType === "line" &&
            visibleKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colorOf(key)}
                strokeWidth={2}
                strokeOpacity={hoveredLegendKey !== null && hoveredLegendKey !== key ? 0.15 : 1}
                dot={{ r: 3, fill: colorOf(key), stroke: "white", strokeWidth: 1.5 }}
                activeDot={{ r: 4.5 }}
              />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
