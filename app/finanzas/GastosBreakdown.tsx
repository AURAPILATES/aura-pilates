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
  return `${(n * 100).toFixed(1)}%`;
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
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8 sm:items-start">
        {/* Donut */}
        <div className="shrink-0 flex items-center justify-center sm:block">
          <svg width="160" height="160" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={18}
                strokeDasharray={`${seg.dash} ${CIRC - seg.dash}`}
                strokeDashoffset={seg.offset}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setSelected(seg.category)}
              />
            ))}
          </svg>
        </div>

        {/* List */}
        <div className="flex-1 min-w-0">
          {segments.map((seg, i) => {
            const cfg = EXPENSE_EMOJI[seg.category] ?? { emoji: "📦", bg: "#F1F5F9" };
            return (
              <button
                key={i}
                onClick={() => setSelected(seg.category)}
                className="w-full flex items-center gap-4 py-4 border-b border-navy/[0.05] last:border-0 text-left hover:bg-navy/[0.015] -mx-2 px-2 rounded-xl transition-colors group"
              >
                {/* Icon */}
                <div className="relative shrink-0">
                  <div
                    className="w-13 h-13 rounded-full flex items-center justify-center text-2xl group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: cfg.bg, width: 52, height: 52 }}
                  >
                    {cfg.emoji}
                  </div>
                  <span
                    className="absolute -top-0.5 -left-0.5 w-3 h-3 rounded-full ring-2 ring-white"
                    style={{ backgroundColor: seg.color }}
                  />
                </div>

                {/* Name + count */}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-bold text-navy truncate">{seg.category}</p>
                  <p className="text-xs text-navy/50 mt-0.5">{seg.count} transacciones</p>
                </div>

                {/* Amount + pct */}
                <div className="text-right shrink-0">
                  <p className="text-[15px] font-bold text-navy tabular-nums">−{fmt(seg.total)}</p>
                  <p className="text-xs text-navy/45 tabular-nums mt-0.5">{pct(seg.share)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Drawer */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-navy/20 backdrop-blur-[1px]"
            onClick={() => setSelected(null)}
          />
          <div className="fixed inset-0 sm:inset-auto sm:right-0 sm:top-0 sm:bottom-0 z-50 sm:w-[420px] bg-white shadow-2xl flex flex-col">
            <div className="flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-navy/10">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: EXPENSE_EMOJI[selected]?.bg ?? "#F1F5F9" }}
              >
                {EXPENSE_EMOJI[selected]?.emoji ?? "📦"}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-navy">{selected}</h2>
                <p className="text-xs text-navy/50 mt-0.5">
                  −{fmt(selectedSeg?.total ?? 0)} · {selectedSeg?.count ?? 0} transacciones
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
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
                  className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/45 hover:text-navy transition-colors text-base"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedTxns.length === 0 ? (
                <p className="text-sm text-navy/45 px-4 py-8">Sin transacciones registradas.</p>
              ) : (
                selectedTxns.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-navy/5 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">
                        {t.contact || t.concept}
                      </p>
                      <p className="text-xs text-navy/50 mt-0.5">{t.date.split("-").reverse().join("/")}</p>
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
