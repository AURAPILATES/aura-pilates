"use client";
import { useState } from "react";
import { BookOpen } from "react-feather";
import type { ConversionCohort, ConversionSummary } from "@/lib/sales";

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDate(d: string) {
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

function CohortModal({ cohort, onClose }: { cohort: ConversionCohort; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy/[0.07]">
          <div>
            <h2 className="text-base font-bold text-navy font-display">{cohort.label}</h2>
            <p className="text-xs text-navy/45 mt-0.5">{cohort.converted} de {cohort.buyers} convertidos ({fmtPct(cohort.rate)})</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-navy/40 hover:text-navy hover:bg-navy/5 transition-colors">✕</button>
        </div>
        <div className="overflow-y-auto px-6 py-4 space-y-2">
          {cohort.buyersDetail
            .slice()
            .sort((a, b) => Number(b.converted) - Number(a.converted))
            .map((b) => (
              <div key={b.email} className="flex items-center justify-between gap-3 py-2 border-b border-navy/[0.04] last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-navy font-medium truncate">{b.name ?? b.email}</p>
                  <p className="text-xs text-navy/45 truncate">{b.email} · pack {fmtDate(b.packDate)}</p>
                </div>
                {b.converted ? (
                  <span className="shrink-0 text-xs font-semibold text-success bg-success/10 px-2 py-1 rounded-full">
                    Convertido {b.convertedDate ? fmtDate(b.convertedDate) : ""}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-navy/40 bg-navy/[0.04] px-2 py-1 rounded-full">Sin convertir</span>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

const SVG_W = 900;
const SVG_H = 200;
const MT = 20;
const MR = 20;
const MB = 30;
const ML = 42;

export default function ConversionChart({ summary }: { summary: ConversionSummary }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedCohort, setSelectedCohort] = useState<ConversionCohort | null>(null);
  const { cohorts, totalBuyers, totalConverted, rate } = summary;

  if (cohorts.length === 0) {
    return (
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
        <p className="text-xs font-semibold text-navy/55 uppercase tracking-widest mb-4">
          Conversión Pack Benvinguda 2x1 → Suscripción
        </p>
        <p className="text-sm text-navy/45 text-center py-10">Sin compras del pack registradas</p>
      </div>
    );
  }

  const N = cohorts.length;
  const cW = SVG_W - ML - MR;
  const cH = SVG_H - MT - MB;
  const xOf = (i: number) => ML + (N > 1 ? (i / (N - 1)) * cW : cW / 2);
  const yOf = (v: number) => MT + cH * (1 - v); // v in [0,1]

  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const line = cohorts.map((c, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(c.rate)}`).join(" ");
  const area = line + ` L${xOf(N - 1)},${yOf(0)} L${xOf(0)},${yOf(0)} Z`;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = SVG_W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const raw = ((mouseX - ML) / cW) * (N - 1);
    setHoveredIdx(Math.max(0, Math.min(N - 1, Math.round(raw))));
  }

  const TW = 150;
  const TH = 56;

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-xs font-semibold text-navy/55 uppercase tracking-widest">
          Conversión Pack Benvinguda 2x1 (25€) → Suscripción
        </p>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-semibold text-navy">{fmtPct(rate)}</span>
        <span className="text-sm text-navy/45">{totalConverted} de {totalBuyers} compradores se suscribieron después</span>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        overflow="visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIdx(null)}
        onClick={() => { if (hoveredIdx !== null) setSelectedCohort(cohorts[hoveredIdx]); }}
        style={{ cursor: "pointer" }}
      >
        <defs>
          <filter id="conv-shadow" x="-10%" y="-20%" width="120%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.08" />
          </filter>
        </defs>

        {yTicks.map((t) => {
          const y = yOf(t);
          return (
            <g key={t}>
              <line x1={ML} y1={y} x2={SVG_W - MR} y2={y} stroke="#E2E8F0" strokeWidth="1" />
              <text x={ML - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill="#94A3B8">{fmtPct(t)}</text>
            </g>
          );
        })}

        <path d={area} fill="#6B7ED6" fillOpacity="0.1" />
        <path d={line} fill="none" stroke="#6B7ED6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {cohorts.map((c, i) => (
          <circle key={c.month} cx={xOf(i)} cy={yOf(c.rate)} r={hoveredIdx === i ? 4.5 : 3}
            fill="#6B7ED6" stroke="white" strokeWidth={hoveredIdx === i ? 2 : 1.5} />
        ))}

        {hoveredIdx !== null && (
          <line x1={xOf(hoveredIdx)} y1={MT} x2={xOf(hoveredIdx)} y2={MT + cH}
            stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 3" pointerEvents="none" />
        )}

        {cohorts.map((c, i) => (
          <text key={c.month} x={xOf(i)} y={SVG_H - MB + 16} textAnchor="middle" fontSize="9.5" fill="#94A3B8">
            {c.label.replace(" ", "'").slice(0, -2)}
          </text>
        ))}

        {hoveredIdx !== null && (() => {
          const c = cohorts[hoveredIdx];
          const sx = xOf(hoveredIdx);
          const flipL = sx + TW + 16 > SVG_W - MR;
          const tx = flipL ? sx - TW - 12 : sx + 12;
          const ty = MT;
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={TW} height={TH} rx="6" fill="white" stroke="#E2E8F0" strokeWidth="1" filter="url(#conv-shadow)" />
              <text x={tx + 10} y={ty + 15} fontSize="10" fontWeight="700" fill="#334155">{c.label}</text>
              <text x={tx + 10} y={ty + 31} fontSize="9.5" fill="#64748B">{c.converted} / {c.buyers} convertidos</text>
              <text x={tx + 10} y={ty + 46} fontSize="11" fontWeight="700" fill="#6B7ED6">{fmtPct(c.rate)}</text>
            </g>
          );
        })()}

        <rect x={ML} y={MT} width={cW} height={cH} fill="transparent" />
      </svg>

      {/* Tabla de cohortes */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-navy/[0.06]">
              <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Mes</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Compradores</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Convertidos</th>
              <th className="text-right py-2 text-navy/45 font-semibold uppercase tracking-wide">% conversión</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <tr
                key={c.month}
                onClick={() => setSelectedCohort(c)}
                className="border-b border-navy/[0.04] last:border-0 cursor-pointer hover:bg-navy/[0.02] transition-colors"
              >
                <td className="py-2 pr-3 text-navy/70">{c.label}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{c.buyers}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{c.converted}</td>
                <td className="py-2 text-right font-semibold text-navy tabular-nums">{fmtPct(c.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-navy/45 mt-3 flex items-center gap-1.5">
        <BookOpen size={12} className="shrink-0" />
        Cohorte = mes de compra del pack. Convertido = compró una suscripción en una fecha posterior. Haz clic en un punto o una fila para ver el detalle.
      </p>

      {selectedCohort && (
        <CohortModal cohort={selectedCohort} onClose={() => setSelectedCohort(null)} />
      )}
    </div>
  );
}
