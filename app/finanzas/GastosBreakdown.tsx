"use client";
import { useState } from "react";
import Link from "next/link";

type Category = {
  category: string;
  count: number;
  total: number;
  color: string;
};

type Txn = {
  date: string;
  amount: number;
  concept: string;
  contact: string;
};

// ── Category SVG icon paths (white, rendered on colored circle) ───────────────

function CategoryIcon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, React.ReactNode> = {
    "Alquiler": (
      <>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </>
    ),
    "Salarios": (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </>
    ),
    "Electricidad": (
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    ),
    "Agua": (
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
    ),
    "Software": (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </>
    ),
    "Gestoría y legal": (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </>
    ),
    "Impuestos y tasas": (
      <>
        <line x1="19" y1="5" x2="5" y2="19"/>
        <circle cx="6.5" cy="6.5" r="2.5"/>
        <circle cx="17.5" cy="17.5" r="2.5"/>
      </>
    ),
    "Teléfono": (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    ),
    "Seguros": (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    ),
    "Comisiones bancarias": (
      <>
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </>
    ),
    "Merchandising": (
      <>
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </>
    ),
    "Local": (
      <>
        <line x1="3" y1="22" x2="21" y2="22"/>
        <rect x="3" y="6" width="18" height="16" rx="1"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <rect x="9" y="15" width="6" height="7"/>
      </>
    ),
  };

  const fallback = (
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
  );

  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: color }}
    >
      <svg
        width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="white" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      >
        {icons[name] ?? fallback}
      </svg>
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
            <CategoryIcon name={seg.category} color={seg.color} />
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
              <CategoryIcon name={selected} color={selectedSeg?.color ?? "#6B7ED6"} />
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-navy">{selected}</h2>
                <p className="text-xs text-navy/55 mt-0.5">
                  −{fmtAmount(selectedSeg?.total ?? 0)} · {selectedSeg?.count ?? 0} transacciones
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={`/transacciones?categoria=${encodeURIComponent(selected)}`}
                  title="Ver en transacciones"
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/45 hover:text-primary transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                </Link>
                <button
                  onClick={() => setSelected(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/45 hover:text-navy transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
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
          </div>
        </>
      )}
    </>
  );
}
