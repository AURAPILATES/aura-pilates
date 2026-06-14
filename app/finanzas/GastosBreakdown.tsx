"use client";
import { useState } from "react";
import Link from "next/link";

type Category = {
  category: string;
  count: number;
  total: number;
  color: string;
  emoji?: string;
  bg_color?: string;
};

type Txn = {
  date: string;
  amount: number;
  concept: string;
  contact: string;
};

// ── Category icon — uses emoji + bg_color from DB when available ──────────────

function CategoryIcon({ name, color, emoji, bg_color }: { name: string; color: string; emoji?: string; bg_color?: string }) {
  return (
    <div
      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-xl"
      style={{ backgroundColor: bg_color ?? color }}
    >
      {emoji ?? "📦"}
    </div>
  );
}

// ── Chart constants ────────────────────────────────────────────────────────────

const R    = 80;
const CX   = 100;
const CY   = 100;
const CIRC = 2 * Math.PI * R;
const SW   = 20; // strokeWidth

function fmtAmount(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}
function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
function fmtDate(d: string) {
  return d.split("-").reverse().join("/");
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GastosBreakdown({
  categories,
  transactionsByCategory,
  totalExpCat,
  rangeLabel,
}: {
  categories: Category[];
  transactionsByCategory: Record<string, Txn[]>;
  totalExpCat: number;
  rangeLabel?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  let acc = 0;
  const segments = categories.map((c) => {
    const share = totalExpCat > 0 ? c.total / totalExpCat : 0;
    const dash   = share * CIRC;
    const gap    = 2; // tiny gap between segments
    const offset = -(acc + (categories.length > 1 ? gap / 2 : 0));
    acc += dash + gap;
    return { ...c, share, dash: Math.max(dash - gap, 0), offset };
  });

  const selectedSeg  = segments.find((s) => s.category === selected) ?? null;
  const selectedTxns = selected
    ? [...(transactionsByCategory[selected] ?? [])].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <>
      {/* ── Donut + center ────────────────────────────────────────────────── */}
      <div className="flex justify-center mb-6">
        <div className="relative w-[220px] h-[220px]">
          <svg viewBox="0 0 200 200" width="220" height="220">
            {/* Track ring */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F0F2FA" strokeWidth={SW} />

            {/* Segments — rotated to start at top */}
            <g transform={`rotate(-90, ${CX}, ${CY})`}>
              {segments.map((seg, i) => (
                <circle
                  key={i}
                  cx={CX} cy={CY} r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={SW}
                  strokeDasharray={`${seg.dash} ${CIRC}`}
                  strokeDashoffset={seg.offset}
                  strokeLinecap="round"
                  className="cursor-pointer transition-opacity"
                  style={{ opacity: selected && selected !== seg.category ? 0.35 : 1 }}
                  onClick={() => setSelected(seg.category === selected ? null : seg.category)}
                />
              ))}
            </g>

            {/* Center text via foreignObject */}
            <foreignObject x="20" y="50" width="160" height="100">
              <div className="h-full flex flex-col items-center justify-center text-center">
                <p className="text-[11px] text-navy/45 font-medium mb-1">Gastos</p>
                <p className="text-xl font-bold text-navy tabular-nums leading-tight">
                  {fmtAmount(totalExpCat)}
                </p>
                {rangeLabel && (
                  <p className="text-[10px] text-navy/40 mt-1">{rangeLabel}</p>
                )}
              </div>
            </foreignObject>
          </svg>
        </div>
      </div>

      {/* ── Category list ─────────────────────────────────────────────────── */}
      <div className="divide-y divide-navy/[0.05]">
        {segments.map((seg) => (
          <button
            key={seg.category}
            onClick={() => setSelected(seg.category === selected ? null : seg.category)}
            className={`w-full flex items-center gap-3 py-3 text-left transition-colors rounded-xl px-2 -mx-2 ${
              selected === seg.category ? "bg-navy/[0.03]" : "hover:bg-navy/[0.02]"
            }`}
          >
            <CategoryIcon name={seg.category} color={seg.color} emoji={seg.emoji} bg_color={seg.bg_color} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy truncate">{seg.category}</p>
              <p className="text-xs text-navy/50">{seg.count} transacciones</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-navy tabular-nums">
                −{fmtAmount(seg.total)}
              </p>
              <p className="text-xs text-navy/50 tabular-nums">{pct(seg.share)}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── Transaction drawer ────────────────────────────────────────────── */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-navy/20 backdrop-blur-[1px]"
            onClick={() => setSelected(null)}
          />
          <div className="fixed inset-0 sm:inset-auto sm:right-0 sm:top-0 sm:bottom-0 z-50 sm:w-[420px] bg-white shadow-2xl flex flex-col">
            <div className="flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-navy/10">
              <CategoryIcon name={selected} color={selectedSeg?.color ?? "#6B7ED6"} emoji={selectedSeg?.emoji} bg_color={selectedSeg?.bg_color} />
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-navy">{selected}</h2>
                <p className="text-xs text-navy/55 mt-0.5">
                  −{fmtAmount(selectedSeg?.total ?? 0)} · {selectedSeg?.count ?? 0} transacciones
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/45 hover:text-navy transition-colors shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedTxns.length === 0 ? (
                <p className="text-sm text-navy/45 px-6 py-8">Sin transacciones registradas.</p>
              ) : (
                selectedTxns.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-navy/5 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{t.contact || t.concept}</p>
                      <p className="text-xs text-navy/55 mt-0.5">{fmtDate(t.date)}</p>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums shrink-0 ${t.amount < 0 ? "text-navy" : "text-success"}`}>
                      {t.amount < 0 ? "−" : "+"}{fmtAmount(Math.abs(t.amount))}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-navy/10">
              <Link
                href={`/transacciones?categoria=${encodeURIComponent(selected)}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-navy/20 bg-white text-sm font-medium text-navy hover:border-navy/40 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Ver transacciones
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
