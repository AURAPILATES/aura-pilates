"use client";
import { useState, useRef, useEffect } from "react";
import { BookOpen } from "react-feather";
import type { Sale } from "@/lib/sales";

type View        = "canal" | "producto";
type ChartType   = "line" | "bar";
type CompareMode = "none" | "prev" | "months";

const MONTH_NAMES: Record<string, string> = {
  "01":"Ene","02":"Feb","03":"Mar","04":"Abr",
  "05":"May","06":"Jun","07":"Jul","08":"Ago",
  "09":"Sep","10":"Oct","11":"Nov","12":"Dic",
};

const CHANNEL_COLORS: Record<string, string> = {
  "Tarjeta":           "#6B7ED6",
  "urban-sports-club": "#D4AA35",
  "Efectivo":          "#4A9870",
};

const CHANNEL_LABELS: Record<string, string> = {
  "Tarjeta":           "Tarjeta",
  "urban-sports-club": "Urban Sports Club",
  "Efectivo":          "Efectivo",
};

const PRODUCT_COLORS = [
  "#6B7ED6","#9260B8","#D4AA35","#4A7A9B",
  "#4A9870","#D46055","#C46890","#3AA09C",
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

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const SVG_W = 900;
const SVG_H  = 220;
const MT = 20;
const MR = 20;
const MB = 30;
const ML = 42;

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

function RadioDot({ active }: { active: boolean }) {
  return (
    <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0 ${
      active ? "border-navy" : "border-navy/30"
    }`}>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-navy" />}
    </span>
  );
}

export default function EvolucionChart({ sales, salesAll }: { sales: Sale[]; salesAll?: Sale[] }) {
  const [view,        setView]        = useState<View>("canal");
  const [chartType,   setChartType]   = useState<ChartType>("line");
  const [hoveredIdx,  setHoveredIdx]  = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState<CompareMode>("none");
  const [compareN,    setCompareN]    = useState(1);
  const [showPicker,  setShowPicker]  = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const getKey = view === "canal" ? (s: Sale) => s.method : (s: Sale) => s.item;
  const { months, data } = buildSeries(sales, getKey);
  const { data: dataAll } = buildSeries(salesAll ?? [], getKey);

  const rawKeys = [...new Set(sales.map(getKey))];
  const keysByRevenue = [...rawKeys].sort((a, b) => {
    const totA = months.reduce((s, m) => s + (data.get(m)?.get(a) ?? 0), 0);
    const totB = months.reduce((s, m) => s + (data.get(m)?.get(b) ?? 0), 0);
    return totB - totA;
  });
  const keys = view === "producto" ? keysByRevenue.slice(0, 7) : keysByRevenue;

  const compareOffset = compareMode === "none" ? 0
    : compareMode === "prev" ? months.length
    : compareN;
  const isComparing = compareOffset > 0 && !!salesAll && salesAll.length > 0;

  const allValues = months.flatMap((m) => {
    const curr = keys.map((k) => data.get(m)?.get(k) ?? 0);
    const comp = isComparing
      ? keys.map((k) => dataAll.get(shiftMonth(m, -compareOffset))?.get(k) ?? 0)
      : [];
    return [...curr, ...comp];
  });
  const maxValue = Math.max(...allValues, 1);
  const mag      = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const niceTop  = Math.ceil(maxValue / mag) * mag;
  const yTicks   = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceTop * t));

  const cW = SVG_W - ML - MR;
  const cH = SVG_H - MT - MB;
  const N  = months.length;
  const K  = keys.length;
  const xOf      = (i: number) => ML + (i / Math.max(N - 1, 1)) * cW;
  const yOf      = (v: number) => MT + cH * (1 - v / niceTop);
  const groupW    = cW / Math.max(N, 1);
  const GROUP_PAD = 4;
  const barW      = Math.max((groupW - GROUP_PAD * 2) / Math.max(K, 1) - 2, 2);
  const barGroupX = (mi: number) => ML + mi * groupW + GROUP_PAD;
  const barX      = (mi: number, ki: number) => barGroupX(mi) + ki * (barW + 2);
  const barCx     = (mi: number) => ML + (mi + 0.5) * groupW;

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

  // Tooltip dimensions
  const TW       = isComparing ? 218 : 172;
  const ROW_H    = 16;
  const DIV_H    = 16;
  const TH       = 24 + K * ROW_H + (isComparing ? DIV_H + K * ROW_H : 0) + 8;

  const hoverX = hoveredIdx !== null
    ? (chartType === "line" ? xOf(hoveredIdx) : barCx(hoveredIdx))
    : null;

  const compareLabel = compareMode === "none"
    ? "Comparar"
    : compareMode === "prev"
    ? "vs período anterior"
    : `vs hace ${compareN}m`;

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex border border-navy/10 rounded-lg overflow-hidden text-xs shrink-0">
            <button
              onClick={() => setChartType("line")}
              title="Línea"
              className={`px-2.5 py-1.5 transition-colors ${
                chartType === "line" ? "bg-navy text-white" : "bg-white text-navy/55 hover:text-navy/70"
              }`}
            >
              <IconLine />
            </button>
            <button
              onClick={() => setChartType("bar")}
              title="Barras"
              className={`px-2.5 py-1.5 transition-colors border-l border-navy/10 ${
                chartType === "bar" ? "bg-navy text-white" : "bg-white text-navy/55 hover:text-navy/70"
              }`}
            >
              <IconBar />
            </button>
          </div>
          <p className="text-xs font-semibold text-navy/55 uppercase tracking-widest truncate">
            Evolución de ingresos
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Comparison picker */}
          {salesAll && (
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setShowPicker((v) => !v)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  compareMode !== "none"
                    ? "border-primary/40 bg-primary/5 text-primary font-medium"
                    : "border-navy/10 bg-white text-navy/55 hover:text-navy/70"
                }`}
              >
                {compareLabel}
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className={`transition-transform ${showPicker ? "rotate-180" : ""}`}>
                  <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showPicker && (
                <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-navy/10 rounded-xl shadow-lg p-2 min-w-[210px]">
                  <button
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left ${
                      compareMode === "none" ? "bg-navy/5 text-navy font-medium" : "text-navy/60 hover:bg-navy/[0.03]"
                    }`}
                    onClick={() => { setCompareMode("none"); setShowPicker(false); }}
                  >
                    <RadioDot active={compareMode === "none"} />
                    Sin comparativa
                  </button>

                  <button
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left ${
                      compareMode === "prev" ? "bg-navy/5 text-navy font-medium" : "text-navy/60 hover:bg-navy/[0.03]"
                    }`}
                    onClick={() => { setCompareMode("prev"); setShowPicker(false); }}
                  >
                    <RadioDot active={compareMode === "prev"} />
                    Período anterior
                  </button>

                  <div className="my-1 border-t border-navy/5" />

                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                      compareMode === "months" ? "bg-navy/5" : "hover:bg-navy/[0.03]"
                    }`}
                    onClick={() => setCompareMode("months")}
                  >
                    <RadioDot active={compareMode === "months"} />
                    <span className={compareMode === "months" ? "text-navy font-medium" : "text-navy/60"}>Hace</span>
                    <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="w-5 h-5 flex items-center justify-center rounded border border-navy/15 text-navy/60 hover:bg-navy/5 disabled:opacity-30"
                        onClick={(e) => { e.stopPropagation(); setCompareN((n) => Math.max(1, n - 1)); setCompareMode("months"); }}
                        disabled={compareN <= 1}
                      >−</button>
                      <span className={`w-5 text-center font-semibold tabular-nums ${compareMode === "months" ? "text-navy" : "text-navy/60"}`}>
                        {compareN}
                      </span>
                      <button
                        className="w-5 h-5 flex items-center justify-center rounded border border-navy/15 text-navy/60 hover:bg-navy/5 disabled:opacity-30"
                        onClick={(e) => { e.stopPropagation(); setCompareN((n) => Math.min(24, n + 1)); setCompareMode("months"); }}
                        disabled={compareN >= 24}
                      >+</button>
                    </div>
                    <span className={compareMode === "months" ? "text-navy font-medium" : "text-navy/60"}>meses</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Canal / Producto toggle */}
          <div className="flex border border-navy/10 rounded-lg overflow-hidden text-xs shrink-0">
            {(["canal", "producto"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 sm:px-3 py-1.5 font-medium transition-colors ${
                  view === v
                    ? "bg-navy text-white"
                    : "bg-white text-navy/55 hover:text-navy/70 hover:bg-navy/[0.03]"
                } ${v === "producto" ? "border-l border-navy/10" : ""}`}
              >
                {v === "canal"
                  ? <span><span className="sm:hidden">Canal</span><span className="hidden sm:inline">Canal de pago</span></span>
                  : "Producto"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 items-center">
        {keys.map((key, i) => {
          const color = getColor(key, i);
          return (
            <span key={key} className="flex items-center gap-1.5 text-xs text-navy/60">
              {chartType === "line" ? (
                <span className="inline-block w-8 h-0.5 rounded-full" style={{ backgroundColor: color }} />
              ) : (
                <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
              )}
              {getLabel(key)}
            </span>
          );
        })}
        {isComparing && (
          <span className="flex items-center gap-1.5 text-xs text-navy/40 italic ml-1">
            <svg width="20" height="4" viewBox="0 0 20 4">
              <line x1="0" y1="2" x2="20" y2="2" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 2" />
            </svg>
            {compareMode === "prev" ? `hace ${months.length}m` : `hace ${compareN}m`}
          </span>
        )}
      </div>

      {sales.length === 0 ? (
        <p className="text-sm text-navy/45 text-center py-10">Sin datos de ventas</p>
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
                const color = getColor(key, ki);
                const ptArr = months.map((m, i) => ({ x: xOf(i), y: yOf(data.get(m)?.get(key) ?? 0) }));
                const pathD =
                  ptArr.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") +
                  ` L${ptArr[ptArr.length - 1].x},${MT + cH} L${ptArr[0].x},${MT + cH} Z`;
                return <path key={`area-${key}`} d={pathD} fill={color} fillOpacity="0.06" />;
              })}

              {/* Comparison lines (dashed) */}
              {isComparing && keys.map((key, ki) => {
                const color = getColor(key, ki);
                const pts   = months.map((m, i) => {
                  const cm = shiftMonth(m, -compareOffset);
                  return `${xOf(i)},${yOf(dataAll.get(cm)?.get(key) ?? 0)}`;
                }).join(" ");
                return (
                  <polyline key={`comp-${key}`} points={pts} fill="none" stroke={color}
                    strokeWidth="1.5" strokeDasharray="5 3" strokeLinejoin="round"
                    strokeLinecap="round" opacity="0.45" />
                );
              })}

              {/* Lines + dots */}
              {keys.map((key, ki) => {
                const color = getColor(key, ki);
                const pts   = months.map((m, i) => `${xOf(i)},${yOf(data.get(m)?.get(key) ?? 0)}`).join(" ");
                return (
                  <g key={key}>
                    <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
                      strokeLinejoin="round" strokeLinecap="round" />
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
              {/* Current bars */}
              {months.map((m, mi) => (
                <g key={m}>
                  {keys.map((key, ki) => {
                    const v = data.get(m)?.get(key) ?? 0;
                    if (v === 0) return null;
                    const color = getColor(key, ki);
                    const bh    = (v / niceTop) * cH;
                    const isH   = hoveredIdx === mi;
                    return (
                      <rect key={key}
                        x={barX(mi, ki)} y={MT + cH - bh}
                        width={barW} height={bh} rx="2"
                        fill={color}
                        opacity={hoveredIdx !== null && !isH ? 0.4 : 1}
                      />
                    );
                  })}
                </g>
              ))}
              {/* Comparison: horizontal tick at comparison value height */}
              {isComparing && months.map((m, mi) => (
                <g key={`comp-${m}`}>
                  {keys.map((key, ki) => {
                    const cm = shiftMonth(m, -compareOffset);
                    const v  = dataAll.get(cm)?.get(key) ?? 0;
                    if (v === 0) return null;
                    const color = getColor(key, ki);
                    const cy   = yOf(v);
                    const bx   = barX(mi, ki);
                    const isH  = hoveredIdx === mi;
                    return (
                      <line key={key}
                        x1={bx} x2={bx + barW} y1={cy} y2={cy}
                        stroke={color} strokeWidth="2" strokeLinecap="round"
                        opacity={hoveredIdx !== null && !isH ? 0.2 : 0.55}
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
            const month   = months[hoveredIdx];
            const compM   = isComparing ? shiftMonth(month, -compareOffset) : null;
            const sx      = hoverX!;
            const flipL   = sx + TW + 16 > SVG_W - MR;
            const tx      = flipL ? sx - TW - 12 : sx + 12;
            const ty      = MT;
            const [y, mm] = month.split("-");

            return (
              <g pointerEvents="none">
                <rect x={tx} y={ty} width={TW} height={TH} rx="6"
                  fill="white" stroke="#E2E8F0" strokeWidth="1" filter="url(#evol-shadow)" />

                {/* Current month header */}
                <text x={tx + 10} y={ty + 15} fontSize="10" fontWeight="700" fill="#334155">
                  {MONTH_NAMES[mm]} {y}
                </text>

                {/* Current rows (with delta badge when comparing) */}
                {keys.map((key, ki) => {
                  const v     = data.get(month)?.get(key) ?? 0;
                  const color = getColor(key, ki);
                  const rowY  = ty + 24 + ki * ROW_H;
                  const compV = compM ? (dataAll.get(compM)?.get(key) ?? 0) : 0;
                  const delta = compM && compV > 0 ? ((v - compV) / compV) * 100 : null;
                  return (
                    <g key={key}>
                      <circle cx={tx + 14} cy={rowY + 4} r="3.5" fill={color} />
                      <text x={tx + 24} y={rowY + 8} fontSize="9.5" fill="#64748B">
                        {getLabel(key)}
                      </text>
                      <text
                        x={tx + TW - (delta !== null ? 36 : 10)}
                        y={rowY + 8}
                        fontSize="9.5" fontWeight="600" fill="#0F172A" textAnchor="end"
                      >
                        {fmtEur(v)}
                      </text>
                      {delta !== null && (
                        <text x={tx + TW - 6} y={rowY + 8} fontSize="8.5" fontWeight="600"
                          fill={delta >= 0 ? "#22c55e" : "#ef4444"} textAnchor="end">
                          {delta >= 0 ? "▲" : "▼"}{Math.abs(Math.round(delta))}%
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Comparison section */}
                {compM && (() => {
                  const [cy2, cmm] = compM.split("-");
                  const divY = ty + 24 + K * ROW_H + 2;
                  return (
                    <>
                      <line x1={tx + 8} y1={divY} x2={tx + TW - 8} y2={divY}
                        stroke="#E2E8F0" strokeWidth="1" />
                      <text x={tx + 10} y={divY + 11} fontSize="8.5" fill="#94A3B8">
                        vs {MONTH_NAMES[cmm]} {cy2}
                      </text>
                      {keys.map((key, ki) => {
                        const v     = dataAll.get(compM)?.get(key) ?? 0;
                        const color = getColor(key, ki);
                        const rowY  = divY + 14 + ki * ROW_H;
                        return (
                          <g key={`comp-tip-${key}`}>
                            <circle cx={tx + 14} cy={rowY + 4} r="3" fill={color} opacity="0.4" />
                            <text x={tx + 24} y={rowY + 8} fontSize="9.5" fill="#94A3B8">
                              {getLabel(key)}
                            </text>
                            <text x={tx + TW - 10} y={rowY + 8} fontSize="9.5"
                              fill="#94A3B8" textAnchor="end">
                              {fmtEur(v)}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </g>
            );
          })()}

          {/* Mouse capture overlay */}
          <rect x={ML} y={MT} width={cW} height={cH} fill="transparent" />
        </svg>
      )}

      <p className="text-xs text-navy/45 mt-2 flex items-center gap-1.5">
        <BookOpen size={12} className="shrink-0" />
        Stripe · ingresos brutos por mes.
      </p>
    </div>
  );
}
