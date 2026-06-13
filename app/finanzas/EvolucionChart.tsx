"use client";
import { useState } from "react";
import { BookOpen } from "react-feather";
import type { Sale } from "@/lib/sales";

type View      = "canal" | "producto";
type ChartType = "line" | "bar";

const MONTH_NAMES: Record<string, string> = {
  "01":"Ene","02":"Feb","03":"Mar","04":"Abr",
  "05":"May","06":"Jun","07":"Jul","08":"Ago",
  "09":"Sep","10":"Oct","11":"Nov","12":"Dic",
};

const CHANNEL_COLORS: Record<string, string> = {
  "Tarjeta":           "#4F6FFF",
  "urban-sports-club": "#F59E0B",
  "Efectivo":          "#10B981",
};

const CHANNEL_LABELS: Record<string, string> = {
  "Tarjeta":           "Tarjeta",
  "urban-sports-club": "Urban Sports Club",
  "Efectivo":          "Efectivo",
};

const PRODUCT_COLORS = [
  "#4F6FFF","#10B981","#F59E0B","#8B5CF6",
  "#EF4444","#06B6D4","#EC4899","#84CC16",
];

function fmtTick(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;
}

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

function buildSeries(sales: Sale[], getKey: (s: Sale) => string) {
  const months = [...new Set(sales.map((s) => s.paymentDate.slice(0, 7)))].sort();
  const data   = new Map<string, Map<string, number>>();
  for (const s of sales) {
    const m = s.paymentDate.slice(0, 7);
    const k = getKey(s);
    if (!data.has(m)) data.set(m, new Map());
    const row = data.get(m)!;
    row.set(k, (row.get(k) ?? 0) + s.amount);
  }
  return { months, data };
}

const SVG_W = 900;
const SVG_H  = 220;
const MT = 20;
const MR = 20;
const MB = 30;
const ML = 42;

// Icons as inline SVG paths
function IconLine() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block">
      <polyline points="1,13 5,7 9,10 15,3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
function IconBar() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block">
      <rect x="2"  y="9"  width="3" height="6" rx="1" fill="currentColor" />
      <rect x="7"  y="5"  width="3" height="10" rx="1" fill="currentColor" />
      <rect x="12" y="2"  width="3" height="13" rx="1" fill="currentColor" />
    </svg>
  );
}

export default function EvolucionChart({ sales }: { sales: Sale[] }) {
  const [view,      setView]      = useState<View>("canal");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const getKey = view === "canal" ? (s: Sale) => s.method : (s: Sale) => s.item;
  const { months, data } = buildSeries(sales, getKey);

  const rawKeys = [...new Set(sales.map(getKey))];
  const keysByRevenue = [...rawKeys].sort((a, b) => {
    const totA = months.reduce((s, m) => s + (data.get(m)?.get(a) ?? 0), 0);
    const totB = months.reduce((s, m) => s + (data.get(m)?.get(b) ?? 0), 0);
    return totB - totA;
  });
  const keys = view === "producto" ? keysByRevenue.slice(0, 7) : keysByRevenue;

  const allValues = months.flatMap((m) => keys.map((k) => data.get(m)?.get(k) ?? 0));
  const maxValue  = Math.max(...allValues, 1);
  const mag       = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const niceTop   = Math.ceil(maxValue / mag) * mag;
  const yTicks    = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceTop * t));

  const cW = SVG_W - ML - MR;
  const cH = SVG_H - MT - MB;
  const N  = months.length;
  const K  = keys.length;
  const xOf  = (i: number) => ML + (i / Math.max(N - 1, 1)) * cW;
  const yOf  = (v: number) => MT + cH * (1 - v / niceTop);

  // Bar geometry
  const groupW    = cW / Math.max(N, 1);
  const GROUP_PAD = 4;
  const barW      = Math.max((groupW - GROUP_PAD * 2) / Math.max(K, 1) - 2, 2);
  const barGroupX = (mi: number) => ML + mi * groupW + GROUP_PAD;
  const barX      = (mi: number, ki: number) => barGroupX(mi) + ki * (barW + 2);
  const barCx     = (mi: number) => ML + (mi + 0.5) * groupW; // center of group for tooltip line

  const getColor = (key: string, i: number) =>
    view === "canal" ? (CHANNEL_COLORS[key] ?? "#6B7280") : PRODUCT_COLORS[i % PRODUCT_COLORS.length];
  const getLabel = (key: string) =>
    view === "canal" ? (CHANNEL_LABELS[key] ?? key) : key;

  const showEvery = N > 8 ? 2 : 1;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg  = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = SVG_W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    if (chartType === "line") {
      const raw = ((mouseX - ML) / cW) * (N - 1);
      setHoveredIdx(Math.max(0, Math.min(N - 1, Math.round(raw))));
    } else {
      const raw = (mouseX - ML) / groupW;
      setHoveredIdx(Math.max(0, Math.min(N - 1, Math.floor(raw))));
    }
  }

  // Tooltip geometry
  const TW    = 172;
  const ROW_H = 16;
  const TH    = 24 + K * ROW_H + 4;

  const hoverX = hoveredIdx !== null
    ? (chartType === "line" ? xOf(hoveredIdx) : barCx(hoveredIdx))
    : null;

  return (
    <div className="bg-white border border-navy/10 rounded shadow-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {/* Line / Bar toggle */}
          <div className="flex border border-navy/10 rounded-lg overflow-hidden text-xs shrink-0">
            <button
              onClick={() => setChartType("line")}
              title="Línea"
              className={`px-2.5 py-1.5 transition-colors ${
                chartType === "line" ? "bg-navy text-white" : "bg-white text-navy/40 hover:text-navy/70"
              }`}
            >
              <IconLine />
            </button>
            <button
              onClick={() => setChartType("bar")}
              title="Barras"
              className={`px-2.5 py-1.5 transition-colors border-l border-navy/10 ${
                chartType === "bar" ? "bg-navy text-white" : "bg-white text-navy/40 hover:text-navy/70"
              }`}
            >
              <IconBar />
            </button>
          </div>
          <p className="text-xs font-semibold text-navy/40 uppercase tracking-widest truncate">
            Evolución de ingresos
          </p>
        </div>

        {/* Canal / Producto toggle */}
        <div className="flex border border-navy/10 rounded-lg overflow-hidden text-xs shrink-0">
          {(["canal", "producto"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 sm:px-3 py-1.5 font-medium transition-colors ${
                view === v
                  ? "bg-navy text-white"
                  : "bg-white text-navy/40 hover:text-navy/70 hover:bg-navy/[0.03]"
              }`}
            >
              {v === "canal" ? <span><span className="sm:hidden">Canal</span><span className="hidden sm:inline">Canal de pago</span></span> : "Producto"}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-3">
        {keys.map((key, i) => (
          <span key={key} className="flex items-center gap-1.5 text-xs text-navy/60">
            {chartType === "line" ? (
              <span className="inline-block w-8 h-0.5 rounded-full" style={{ backgroundColor: getColor(key, i) }} />
            ) : (
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: getColor(key, i) }} />
            )}
            {getLabel(key)}
          </span>
        ))}
      </div>

      {sales.length === 0 ? (
        <p className="text-sm text-navy/30 text-center py-10">Sin datos de ventas</p>
      ) : (
        <svg
          width="100%"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          overflow="visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}
          style={{ cursor: "crosshair" }}
        >
          <defs>
            <filter id="evol-shadow" x="-10%" y="-20%" width="120%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.08" />
            </filter>
          </defs>

          {/* Grid + Y axis */}
          {yTicks.map((t) => {
            const y = yOf(t);
            return (
              <g key={t}>
                <line x1={ML} y1={y} x2={SVG_W - MR} y2={y} stroke="#E2E8F0" strokeWidth="1" />
                <text x={ML - 5} y={y + 3.5} textAnchor="end" fontSize="10" fill="#94A3B8">
                  {fmtTick(t)}
                </text>
              </g>
            );
          })}

          {chartType === "line" ? (
            <>
              {/* Area fills */}
              {keys.map((key, ki) => {
                const color  = getColor(key, ki);
                const ptArr  = months.map((m, i) => ({ x: xOf(i), y: yOf(data.get(m)?.get(key) ?? 0) }));
                const pathD  =
                  ptArr.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") +
                  ` L${ptArr[ptArr.length - 1].x},${MT + cH} L${ptArr[0].x},${MT + cH} Z`;
                return <path key={`area-${key}`} d={pathD} fill={color} fillOpacity="0.06" />;
              })}

              {/* Lines + dots */}
              {keys.map((key, ki) => {
                const color = getColor(key, ki);
                const pts   = months.map((m, i) => `${xOf(i)},${yOf(data.get(m)?.get(key) ?? 0)}`).join(" ");
                return (
                  <g key={key}>
                    <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    {months.map((m, i) => {
                      const v = data.get(m)?.get(key) ?? 0;
                      const isH = hoveredIdx === i;
                      if (v === 0 && !isH) return null;
                      return (
                        <circle key={m} cx={xOf(i)} cy={yOf(v)} r={isH ? 4.5 : 3}
                          fill={color} stroke="white" strokeWidth={isH ? 2 : 1.5} />
                      );
                    })}
                  </g>
                );
              })}
            </>
          ) : (
            <>
              {/* Grouped bars */}
              {months.map((m, mi) => (
                <g key={m}>
                  {keys.map((key, ki) => {
                    const v     = data.get(m)?.get(key) ?? 0;
                    if (v === 0) return null;
                    const color = getColor(key, ki);
                    const bh    = (v / niceTop) * cH;
                    const isH   = hoveredIdx === mi;
                    return (
                      <rect
                        key={key}
                        x={barX(mi, ki)}
                        y={MT + cH - bh}
                        width={barW}
                        height={bh}
                        rx="2"
                        fill={color}
                        opacity={hoveredIdx !== null && !isH ? 0.4 : 1}
                      />
                    );
                  })}
                </g>
              ))}
            </>
          )}

          {/* Hover crosshair */}
          {hoverX !== null && (
            <line x1={hoverX} y1={MT} x2={hoverX} y2={MT + cH}
              stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 3" pointerEvents="none" />
          )}

          {/* X-axis labels */}
          {months.map((m, i) => {
            if (i % showEvery !== 0) return null;
            const [y, mm] = m.split("-");
            const cx = chartType === "line" ? xOf(i) : barCx(i);
            return (
              <text key={m} x={cx} y={SVG_H - MB + 16} textAnchor="middle" fontSize="9.5" fill="#94A3B8">
                {MONTH_NAMES[mm]}&apos;{y.slice(2)}
              </text>
            );
          })}

          {/* Tooltip */}
          {hoveredIdx !== null && (() => {
            const month = months[hoveredIdx];
            const sx    = hoverX!;
            const flipL = sx + TW + 16 > SVG_W - MR;
            const tx    = flipL ? sx - TW - 12 : sx + 12;
            const ty    = MT;
            const [y, mm] = month.split("-");
            return (
              <g pointerEvents="none">
                <rect x={tx} y={ty} width={TW} height={TH} rx="6"
                  fill="white" stroke="#E2E8F0" strokeWidth="1" filter="url(#evol-shadow)" />
                <text x={tx + 10} y={ty + 15} fontSize="10" fontWeight="700" fill="#334155">
                  {MONTH_NAMES[mm]} {y}
                </text>
                {keys.map((key, ki) => {
                  const v     = data.get(month)?.get(key) ?? 0;
                  const color = getColor(key, ki);
                  const rowY  = ty + 24 + ki * ROW_H;
                  return (
                    <g key={key}>
                      <circle cx={tx + 14} cy={rowY + 4} r="3.5" fill={color} />
                      <text x={tx + 24} y={rowY + 8} fontSize="9.5" fill="#64748B">
                        {getLabel(key)}
                      </text>
                      <text x={tx + TW - 10} y={rowY + 8} fontSize="9.5" fontWeight="600"
                        fill="#0F172A" textAnchor="end">
                        {fmtEur(v)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* Transparent overlay to capture mouse events */}
          <rect x={ML} y={MT} width={cW} height={cH} fill="transparent" />
        </svg>
      )}

      <p className="text-xs text-navy/30 mt-2 flex items-center gap-1.5">
        <BookOpen size={12} className="shrink-0" />
        Momence sales.csv · ingresos brutos por mes.
      </p>
    </div>
  );
}
