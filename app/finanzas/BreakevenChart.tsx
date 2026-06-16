"use client";
import { useState } from "react";
import { BookOpen } from "react-feather";
import type { BreakevenPoint } from "@/lib/breakeven";

type View = "bruto" | "neto";

function fmtTick(v: number) {
  const abs = Math.abs(v);
  return abs >= 1000 ? `${v < 0 ? "−" : ""}${(abs / 1000).toFixed(0)}k` : `${v}`;
}

function fmtEur(v: number) {
  const sign = v < 0 ? "−" : "";
  return sign + Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

const SVG_W = 900;
const SVG_H = 220;
const MT = 20;
const MR = 20;
const MB = 30;
const ML = 48;

export default function BreakevenChart({ points }: { points: BreakevenPoint[] }) {
  const [view, setView] = useState<View>("bruto");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
        <p className="text-xs font-semibold text-navy/55 uppercase tracking-widest mb-4">Breakeven</p>
        <p className="text-sm text-navy/45 text-center py-10">Sin datos suficientes</p>
      </div>
    );
  }

  const N = points.length;
  const last = points[N - 1];
  const breakevenIdx = points.findIndex((p) => p.cumNet >= 0);
  const isBreakeven = breakevenIdx !== -1;

  const allValues = view === "bruto"
    ? points.flatMap((p) => [p.cumRevenue, p.cumExpenses])
    : points.flatMap((p) => [p.cumNet]);
  const maxValue = Math.max(...allValues, 1);
  const minValue = Math.min(...allValues, 0);
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(Math.abs(maxValue), Math.abs(minValue), 1))));
  const niceTop = Math.ceil(maxValue / mag) * mag;
  const niceBottom = minValue < 0 ? Math.floor(minValue / mag) * mag : 0;
  const range = niceTop - niceBottom || 1;

  const cW = SVG_W - ML - MR;
  const cH = SVG_H - MT - MB;
  const xOf = (i: number) => ML + (i / Math.max(N - 1, 1)) * cW;
  const yOf = (v: number) => MT + cH * (1 - (v - niceBottom) / range);
  const zeroY = yOf(0);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceBottom + range * t));

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = SVG_W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const raw = ((mouseX - ML) / cW) * (N - 1);
    setHoveredIdx(Math.max(0, Math.min(N - 1, Math.round(raw))));
  }

  const showEvery = N > 14 ? Math.ceil(N / 10) : 1;

  const revLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(p.cumRevenue)}`).join(" ");
  const expLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(p.cumExpenses)}`).join(" ");
  const netLine = points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(p.cumNet)}`).join(" ");
  const netAreaAbove = points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(Math.max(p.cumNet, 0))}`).join(" ")
    + ` L${xOf(N - 1)},${zeroY} L${xOf(0)},${zeroY} Z`;
  const netAreaBelow = points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(Math.min(p.cumNet, 0))}`).join(" ")
    + ` L${xOf(N - 1)},${zeroY} L${xOf(0)},${zeroY} Z`;

  const TW = 168;
  const ROW_H = 16;
  const TH = view === "bruto" ? 24 + 2 * ROW_H + 4 : 24 + 1 * ROW_H + 4;

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-xs font-semibold text-navy/55 uppercase tracking-widest">Breakeven desde el inicio</p>
        <div className="flex border border-navy/10 rounded-lg overflow-hidden text-xs shrink-0">
          {(["bruto", "neto"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 font-medium capitalize transition-colors ${
                view === v ? "bg-navy text-white" : "bg-white text-navy/55 hover:text-navy/70 hover:bg-navy/[0.03]"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm mb-4">
        {isBreakeven ? (
          <span className="text-success font-medium">
            Breakeven alcanzado en {points[breakevenIdx].label} · resultado neto acumulado: {fmtEur(last.cumNet)}
          </span>
        ) : (
          <span className="text-navy/55">
            Aún no alcanzado · faltan {fmtEur(Math.abs(last.cumNet))} para cubrir el acumulado
          </span>
        )}
      </p>

      {view === "bruto" && (
        <div className="flex flex-wrap gap-4 mb-3">
          <span className="flex items-center gap-1.5 text-xs text-navy/60">
            <span className="inline-block w-8 h-0.5 rounded-full bg-success" />
            Ingresos acumulados
          </span>
          <span className="flex items-center gap-1.5 text-xs text-navy/60">
            <span className="inline-block w-8 h-0.5 rounded-full bg-danger" />
            Gastos acumulados
          </span>
        </div>
      )}

      <svg
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        overflow="visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
        style={{ cursor: "crosshair" }}
      >
        <defs>
          <filter id="breakeven-shadow" x="-10%" y="-20%" width="120%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Grid + Y axis */}
        {yTicks.map((t) => {
          const y = yOf(t);
          return (
            <g key={t}>
              <line x1={ML} y1={y} x2={SVG_W - MR} y2={y} stroke="#E2E8F0" strokeWidth="1" />
              <text x={ML - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="#94A3B8">{fmtTick(t)}</text>
            </g>
          );
        })}

        {view === "bruto" ? (
          <>
            <path d={revLine} fill="none" stroke="#4A9870" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <path d={expLine} fill="none" stroke="#D46055" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d={netAreaAbove} fill="#4A9870" fillOpacity="0.12" />
            <path d={netAreaBelow} fill="#D46055" fillOpacity="0.12" />
            <line x1={ML} y1={zeroY} x2={SVG_W - MR} y2={zeroY} stroke="#94A3B8" strokeWidth="1" />
            <path d={netLine} fill="none" stroke="#334155" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}

        {/* Breakeven marker */}
        {isBreakeven && (
          <line
            x1={xOf(breakevenIdx)} y1={MT} x2={xOf(breakevenIdx)} y2={MT + cH}
            stroke="#4A9870" strokeWidth="1.5" strokeDasharray="3 3" pointerEvents="none"
          />
        )}

        {/* Hover crosshair */}
        {hoveredIdx !== null && (
          <line x1={xOf(hoveredIdx)} y1={MT} x2={xOf(hoveredIdx)} y2={MT + cH}
            stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 3" pointerEvents="none" />
        )}

        {/* X-axis labels */}
        {points.map((p, i) => {
          if (i % showEvery !== 0) return null;
          return (
            <text key={p.month} x={xOf(i)} y={SVG_H - MB + 16} textAnchor="middle" fontSize="9.5" fill="#94A3B8">
              {p.label.replace(" ", "'").slice(0, -2)}
            </text>
          );
        })}

        {/* Tooltip */}
        {hoveredIdx !== null && (() => {
          const p = points[hoveredIdx];
          const sx = xOf(hoveredIdx);
          const flipL = sx + TW + 16 > SVG_W - MR;
          const tx = flipL ? sx - TW - 12 : sx + 12;
          const ty = MT;
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={TW} height={TH} rx="6" fill="white" stroke="#E2E8F0" strokeWidth="1" filter="url(#breakeven-shadow)" />
              <text x={tx + 10} y={ty + 15} fontSize="10" fontWeight="700" fill="#334155">{p.label}</text>
              {view === "bruto" ? (
                <>
                  <g>
                    <circle cx={tx + 14} cy={ty + 24 + 4} r="3.5" fill="#4A9870" />
                    <text x={tx + 24} y={ty + 24 + 8} fontSize="9.5" fill="#64748B">Ingresos</text>
                    <text x={tx + TW - 10} y={ty + 24 + 8} fontSize="9.5" fontWeight="600" fill="#0F172A" textAnchor="end">{fmtEur(p.cumRevenue)}</text>
                  </g>
                  <g>
                    <circle cx={tx + 14} cy={ty + 24 + ROW_H + 4} r="3.5" fill="#D46055" />
                    <text x={tx + 24} y={ty + 24 + ROW_H + 8} fontSize="9.5" fill="#64748B">Gastos</text>
                    <text x={tx + TW - 10} y={ty + 24 + ROW_H + 8} fontSize="9.5" fontWeight="600" fill="#0F172A" textAnchor="end">{fmtEur(p.cumExpenses)}</text>
                  </g>
                </>
              ) : (
                <g>
                  <circle cx={tx + 14} cy={ty + 24 + 4} r="3.5" fill={p.cumNet >= 0 ? "#4A9870" : "#D46055"} />
                  <text x={tx + 24} y={ty + 24 + 8} fontSize="9.5" fill="#64748B">Resultado neto</text>
                  <text x={tx + TW - 10} y={ty + 24 + 8} fontSize="9.5" fontWeight="600" fill="#0F172A" textAnchor="end">{fmtEur(p.cumNet)}</text>
                </g>
              )}
            </g>
          );
        })()}

        <rect x={ML} y={MT} width={cW} height={cH} fill="transparent" />
      </svg>

      <p className="text-xs text-navy/45 mt-2 flex items-center gap-1.5">
        <BookOpen size={12} className="shrink-0" />
        Ingresos: Stripe + Urban Sports Club · Gastos: operacionales + inversión inicial.
      </p>
    </div>
  );
}
