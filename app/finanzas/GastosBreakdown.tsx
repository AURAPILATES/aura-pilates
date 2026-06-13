"use client";
import { useState } from "react";

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

const EXPENSE_EMOJI: Record<string, { emoji: string; bg: string }> = {
  "Alquiler":            { emoji: "🏠", bg: "#FEF3C7" },
  "Salarios":            { emoji: "👥", bg: "#EDE9FE" },
  "Gestoría y legal":    { emoji: "📋", bg: "#DBEAFE" },
  "Impuestos y tasas":   { emoji: "🧾", bg: "#FEE2E2" },
  "Software":            { emoji: "💻", bg: "#D1FAE5" },
  "Agua":                { emoji: "💧", bg: "#CFFAFE" },
  "Electricidad":        { emoji: "⚡", bg: "#FEF9C3" },
  "Teléfono":            { emoji: "📱", bg: "#F3E8FF" },
  "Seguros":             { emoji: "🛡️", bg: "#FCE7F3" },
  "Comisiones bancarias":{ emoji: "🏦", bg: "#E0F2FE" },
  "Merchandising":       { emoji: "🛍️", bg: "#FDF4FF" },
  "Local":               { emoji: "🏢", bg: "#F5F3FF" },
  "Otros":               { emoji: "📦", bg: "#F1F5F9" },
};

const R = 40; const CX = 50; const CY = 50;
const CIRC = 2 * Math.PI * R;

function fmt(n: number) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default function GastosBreakdown({
  categories,
  transactionsByCategory,
  totalExpCat,
}: {
  categories: Category[];
  transactionsByCategory: Record<string, Txn[]>;
  totalExpCat: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  // Compute donut segments client-side
  let acc = 0;
  const segments = categories.map((c) => {
    const share = totalExpCat > 0 ? c.total / totalExpCat : 0;
    const dash = share * CIRC;
    const offset = -acc;
    acc += dash;
    return { ...c, share, dash, offset };
  });

  const selectedSeg = segments.find((s) => s.category === selected) ?? null;
  const selectedTxns = selected
    ? [...(transactionsByCategory[selected] ?? [])].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <>
      <div className="flex gap-8 items-start">
        {/* Donut */}
        <div className="shrink-0">
          <svg width="140" height="140" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={20}
                strokeDasharray={`${seg.dash} ${CIRC - seg.dash}`}
                strokeDashoffset={seg.offset}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setSelected(seg.category)}
              />
            ))}
          </svg>
        </div>

        {/* Emoji list */}
        <div className="flex-1 divide-y divide-navy/5">
          {segments.map((seg, i) => {
            const cfg = EXPENSE_EMOJI[seg.category] ?? { emoji: "📦", bg: "#F1F5F9" };
            return (
              <button
                key={i}
                onClick={() => setSelected(seg.category)}
                className="w-full flex items-center gap-3 py-3 first:pt-0 last:pb-0 text-left hover:bg-navy/[0.02] -mx-1 px-1 rounded transition-colors group"
              >
                <div className="relative shrink-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-xl group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: cfg.bg }}
                  >
                    {cfg.emoji}
                  </div>
                  <span
                    className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: seg.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{seg.category}</p>
                  <p className="text-xs text-navy/40">{seg.count} transacciones</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-navy tabular-nums">−{fmt(seg.total)}</p>
                  <p className="text-xs text-navy/40 tabular-nums">{pct(seg.share)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Drawer */}
      {selected && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-navy/20 backdrop-blur-[1px]"
            onClick={() => setSelected(null)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 bottom-0 z-50 w-[420px] max-w-[95vw] bg-white shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-navy/10">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: EXPENSE_EMOJI[selected]?.bg ?? "#F1F5F9" }}
                >
                  {EXPENSE_EMOJI[selected]?.emoji ?? "📦"}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-navy">{selected}</h2>
                  <p className="text-xs text-navy/40 mt-0.5">
                    −{fmt(selectedSeg?.total ?? 0)} · {selectedSeg?.count ?? 0} transacciones
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/30 hover:text-navy transition-colors text-sm mt-0.5"
              >
                ✕
              </button>
            </div>

            {/* Transaction list */}
            <div className="flex-1 overflow-y-auto">
              {selectedTxns.length === 0 ? (
                <p className="text-sm text-navy/30 px-6 py-8">Sin transacciones registradas.</p>
              ) : (
                selectedTxns.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 px-6 py-4 border-b border-navy/5 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">
                        {t.contact || t.concept}
                      </p>
                      <p className="text-xs text-navy/40 mt-0.5">{t.date}</p>
                    </div>
                    <p className={`text-sm font-semibold tabular-nums shrink-0 ${t.amount < 0 ? "text-navy" : "text-success"}`}>
                      {t.amount < 0 ? "−" : "+"}{fmt(Math.abs(t.amount))}
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
