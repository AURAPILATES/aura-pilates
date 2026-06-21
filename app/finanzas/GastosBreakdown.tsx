"use client";
import { useState } from "react";
import Link from "next/link";
import Drawer from "@/app/components/Drawer";
import type { EconomicGroup } from "@/lib/transactions";

type LeafCategory = { value: string; label: string; count: number; total: number; color: string; iconKey?: string };
type TopCategory = {
  key: string;
  label: string;
  count: number;
  total: number;
  group: EconomicGroup;
  color: string;
  iconKey?: string;
  children: LeafCategory[];
};

const GROUP_LABELS: Record<EconomicGroup, string> = {
  personal: "Personal",
  operational: "Gasto operativo (OpEx)",
  capex: "Inversión (CapEx)",
};

const GROUP_ORDER: EconomicGroup[] = ["personal", "operational", "capex"];

type Txn = {
  date: string;
  amount: number;
  concept: string;
  contact: string;
};

// ── Category SVG icons (white on colored circle, Revolut style) ───────────────
// Icons are resolved by: 1) iconKey (emoji field from DB), 2) category name fallback

const ICON_BY_KEY: Record<string, React.ReactNode> = {
  "home": <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  "users": <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  "zap": <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  "droplet": <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>,
  "monitor": <><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
  "file-text": <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
  "percent": <><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
  "phone": <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 2.72h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.9a16 16 0 0 0 6.09 6.09l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z"/>,
  "shield": <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  "credit-card": <><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
  "shopping-bag": <><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>,
  "settings": <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  "bar-chart": <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  "trending-up": <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
  "truck": <><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
  "briefcase": <><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
  "globe": <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
  "package": <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
  "coffee": <><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>,
  "star": <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
  "repeat": <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
};

// Fallback: map legacy category names to icon keys
const NAME_TO_KEY: Record<string, string> = {
  "Alquiler": "home", "Local": "home",
  "Salarios": "users", "Seguridad social": "users",
  "Suministros": "zap",
  "Electricidad": "zap", "Luz": "zap",
  "Agua": "droplet",
  "Software": "monitor",
  "Gestoría y legal": "file-text",
  "Impuestos y tasas": "percent", "IVA": "percent", "IRPF": "percent", "IS": "percent",
  "Teléfono": "phone",
  "Seguros": "briefcase",
  "Traspasos internos": "repeat",
  "Comisiones bancarias": "credit-card",
  "Merchandising": "shopping-bag",
  "Material y maquinaria": "settings",
  "Inversión": "bar-chart",
  "Ingresos Stripe": "trending-up", "Ingresos USC": "trending-up",
};

function CategoryIcon({ name, color, iconKey, small = false }: { name: string; color: string; iconKey?: string; small?: boolean }) {
  const key = iconKey && ICON_BY_KEY[iconKey] ? iconKey : (NAME_TO_KEY[name] ?? "package");
  const size = small ? 24 : 40;
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <svg width={small ? 11 : 16} height={small ? 11 : 16} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {ICON_BY_KEY[key] ?? ICON_BY_KEY["package"]}
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
  categories: TopCategory[];
  transactionsByCategory: Record<string, Txn[]>;
  totalExpCat: number;
  rangeLabel?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Orden por grupo económico (Personal → OpEx → CapEx) para que el donut no mezcle
  // inversión con gasto operativo/personal: cada grupo ocupa un arco contiguo.
  const topsOrdered = GROUP_ORDER.flatMap((g) => categories.filter((c) => c.group === g));

  let acc = 0;
  const segments = topsOrdered.map((c) => {
    const share = totalExpCat > 0 ? c.total / totalExpCat : 0;
    const dash   = share * CIRC;
    const gap    = 2; // tiny gap between segments
    const offset = -(acc + (topsOrdered.length > 1 ? gap / 2 : 0));
    acc += dash + gap;
    return { ...c, share, dash: Math.max(dash - gap, 0), offset };
  });

  const selectedTop  = categories.find((c) => c.key === selected) ?? null;
  const selectedLeaf = !selectedTop
    ? categories.flatMap((c) => c.children).find((ch) => ch.value === selected) ?? null
    : null;
  const selectedInfo = selectedTop ?? selectedLeaf;
  const selectedTxns = selectedTop
    ? [...(transactionsByCategory[selectedTop.key] ?? []), ...selectedTop.children.flatMap((ch) => transactionsByCategory[ch.value] ?? [])]
        .sort((a, b) => b.date.localeCompare(a.date))
    : selectedLeaf
      ? [...(transactionsByCategory[selectedLeaf.value] ?? [])].sort((a, b) => b.date.localeCompare(a.date))
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
                  style={{ opacity: selected && selected !== seg.key ? 0.35 : 1 }}
                  onClick={() => setSelected(seg.key === selected ? null : seg.key)}
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

      {/* ── Category list, agrupada por naturaleza económica ────────────────── */}
      <div className="space-y-5">
        {GROUP_ORDER.map((group) => {
          const groupSegs = segments.filter((s) => s.group === group);
          if (groupSegs.length === 0) return null;
          const groupTotal = groupSegs.reduce((s, seg) => s + seg.total, 0);
          const groupShare = totalExpCat > 0 ? groupTotal / totalExpCat : 0;
          return (
            <div key={group}>
              <div className="flex items-center justify-between mb-1 px-2">
                <p className="text-[10px] font-semibold text-navy/45 uppercase tracking-wider">
                  {GROUP_LABELS[group]}
                </p>
                <p className="text-[10px] text-navy/45 tabular-nums">
                  −{fmtAmount(groupTotal)} · {pct(groupShare)}
                </p>
              </div>
              <div className="divide-y divide-navy/[0.05]">
                {groupSegs.map((seg) => {
                  const hasChildren = seg.children.length > 0;
                  const isOpen = expanded.has(seg.key);
                  return (
                    <div key={seg.key}>
                      <button
                        onClick={() => setSelected(seg.key === selected ? null : seg.key)}
                        className={`w-full flex items-center gap-2 py-2 text-left transition-colors rounded-xl px-2 -mx-2 ${
                          selected === seg.key ? "bg-navy/[0.03]" : "hover:bg-navy/[0.02]"
                        }`}
                      >
                        {hasChildren ? (
                          <span
                            onClick={(e) => { e.stopPropagation(); toggleExpanded(seg.key); }}
                            className="shrink-0 w-5 h-5 flex items-center justify-center text-navy/35 hover:text-navy/60 transition-colors"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(90deg)" : undefined, transition: "transform .15s" }}>
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                          </span>
                        ) : (
                          <span className="shrink-0 w-5 h-5" />
                        )}
                        <CategoryIcon name={seg.label} color={seg.color} iconKey={seg.iconKey} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold text-navy truncate">{seg.label}</p>
                          <p className="text-xs text-navy/50">{seg.count} transacciones</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[12px] font-semibold text-navy tabular-nums">
                            −{fmtAmount(seg.total)}
                          </p>
                          <p className="text-xs text-navy/50 tabular-nums">{pct(seg.share)}</p>
                        </div>
                      </button>
                      {hasChildren && isOpen && (
                        <div className="pl-7 pb-1 space-y-0.5">
                          {seg.children.map((ch) => {
                            const chShare = totalExpCat > 0 ? ch.total / totalExpCat : 0;
                            return (
                              <button
                                key={ch.value}
                                onClick={() => setSelected(ch.value === selected ? null : ch.value)}
                                className={`w-full flex items-center gap-2.5 py-1.5 text-left transition-colors rounded-lg px-2 -mx-2 ${
                                  selected === ch.value ? "bg-navy/[0.03]" : "hover:bg-navy/[0.02]"
                                }`}
                              >
                                <CategoryIcon name={ch.label} color={ch.color} iconKey={ch.iconKey} small />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11.5px] font-medium text-navy/80 truncate">{ch.label}</p>
                                </div>
                                <p className="text-[11.5px] text-navy/55 tabular-nums shrink-0">
                                  −{fmtAmount(ch.total)} · {pct(chShare)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selected && selectedInfo && (
        <Drawer
          maxWidth="max-w-[420px]"
          header={
            <div className="flex items-center gap-3">
              <CategoryIcon name={selectedInfo.label} color={selectedInfo.color} iconKey={selectedInfo.iconKey} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-navy">{selectedInfo.label}</h2>
                <p className="text-xs text-navy/55 mt-0.5">
                  −{fmtAmount(selectedInfo.total)} · {selectedInfo.count} transacciones
                </p>
              </div>
            </div>
          }
          footer={
            !(selectedTop && selectedTop.children.length > 0) ? (
              <Link
                href={`/transacciones?categoria=${encodeURIComponent(selected)}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-navy/20 bg-white text-sm font-medium text-navy hover:border-navy/40 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                Ver transacciones
              </Link>
            ) : undefined
          }
          onClose={() => setSelected(null)}
        >
          {selectedTxns.length === 0 ? (
            <p className="text-sm text-navy/45 px-6 py-8">Sin transacciones registradas.</p>
          ) : (
            selectedTxns.map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3.5 border-b border-navy/5 last:border-0">
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
        </Drawer>
      )}
    </>
  );
}
