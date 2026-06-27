"use client";
import { useState } from "react";
import Drawer from "@/app/components/Drawer";
import type { EconomicGroup } from "@/lib/transactions";

type Txn = { date: string; amount: number; concept: string; contact: string };

export type GroupTotal = { group: EconomicGroup; total: number; count: number; txns: Txn[] };

const GROUP_LABELS: Record<EconomicGroup, string> = {
  personal: "Personal",
  operational: "Gasto operativo (OpEx)",
  capex: "Inversión (CapEx)",
};

const GROUP_COLORS: Record<EconomicGroup, string> = {
  personal: "#3A56C5",
  operational: "#1E8C5A",
  capex: "#D4621A",
};

const GROUP_ICONS: Record<EconomicGroup, React.ReactNode> = {
  personal: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  operational: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  capex: <><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
};

function GroupIcon({ group, size = 40 }: { group: EconomicGroup; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{ width: size, height: size, backgroundColor: GROUP_COLORS[group] }}
    >
      <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {GROUP_ICONS[group]}
      </svg>
    </div>
  );
}

const GROUP_ORDER: EconomicGroup[] = ["personal", "operational", "capex"];

function fmtAmount(n: number) {
  return n.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}
function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
function fmtDate(d: string) {
  return d.split("-").reverse().join("/");
}

export default function GastosResumenGeneral({
  groups,
  totalExpCat,
  rangeLabel,
}: {
  groups: GroupTotal[];
  totalExpCat: number;
  rangeLabel?: string | null;
}) {
  const [selected, setSelected] = useState<EconomicGroup | null>(null);

  const ordered = GROUP_ORDER.map((g) => groups.find((x) => x.group === g)).filter((g): g is GroupTotal => !!g && g.total > 0);

  const maxTotal = Math.max(...ordered.map((g) => g.total), 0);
  const segments = ordered.map((g) => {
    const share = totalExpCat > 0 ? g.total / totalExpCat : 0;
    const barWidth = maxTotal > 0 ? g.total / maxTotal : 0;
    return { ...g, share, barWidth };
  });

  const selectedSeg  = segments.find((s) => s.group === selected) ?? null;
  const selectedTxns = selectedSeg
    ? [...selectedSeg.txns].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <>
      <div className="flex items-baseline justify-between mb-5">
        <p className="text-xs text-navy/45 font-medium">Total gastos</p>
        <div className="text-right">
          <p className="text-2xl font-bold text-navy tabular-nums leading-tight">{fmtAmount(totalExpCat)}</p>
          {rangeLabel && <p className="text-[11px] text-navy/40 mt-0.5">{rangeLabel}</p>}
        </div>
      </div>

      <div className="space-y-3">
        {segments.map((seg) => (
          <button
            key={seg.group}
            onClick={() => setSelected(seg.group === selected ? null : seg.group)}
            className={`w-full text-left transition-colors rounded-xl px-2 py-2 -mx-2 ${
              selected === seg.group ? "bg-navy/[0.03]" : "hover:bg-navy/[0.02]"
            }`}
          >
            <div className="flex items-center gap-3 mb-1.5">
              <GroupIcon group={seg.group} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-navy truncate">{GROUP_LABELS[seg.group]}</p>
                <p className="text-xs text-navy/50">{seg.count} transacciones</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-semibold text-navy tabular-nums">−{fmtAmount(seg.total)}</p>
                <p className="text-xs text-navy/50 tabular-nums">{pct(seg.share)}</p>
              </div>
            </div>
            <div className="h-2 bg-navy/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(seg.barWidth * 100, 2)}%`, backgroundColor: GROUP_COLORS[seg.group] }}
              />
            </div>
          </button>
        ))}
      </div>

      {selected && selectedSeg && (
        <Drawer
          maxWidth="max-w-[420px]"
          header={
            <div className="flex items-center gap-3">
              <GroupIcon group={selectedSeg.group} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-navy">{GROUP_LABELS[selectedSeg.group]}</h2>
                <p className="text-xs text-navy/55 mt-0.5">
                  −{fmtAmount(selectedSeg.total)} · {selectedSeg.count} transacciones
                </p>
              </div>
            </div>
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
