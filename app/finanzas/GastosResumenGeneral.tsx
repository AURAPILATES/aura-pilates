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

const R = 80, CX = 100, CY = 100, CIRC = 2 * Math.PI * R, SW = 20;

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

  let acc = 0;
  const segments = ordered.map((g) => {
    const share = totalExpCat > 0 ? g.total / totalExpCat : 0;
    const dash   = share * CIRC;
    const gap    = 2;
    const offset = -(acc + (ordered.length > 1 ? gap / 2 : 0));
    acc += dash + gap;
    return { ...g, share, dash: Math.max(dash - gap, 0), offset };
  });

  const selectedSeg  = segments.find((s) => s.group === selected) ?? null;
  const selectedTxns = selectedSeg
    ? [...selectedSeg.txns].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <>
      <div className="flex justify-center mb-6">
        <div className="relative w-[220px] h-[220px]">
          <svg viewBox="0 0 200 200" width="220" height="220">
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F0F2FA" strokeWidth={SW} />
            <g transform={`rotate(-90, ${CX}, ${CY})`}>
              {segments.map((seg, i) => (
                <circle
                  key={i}
                  cx={CX} cy={CY} r={R}
                  fill="none"
                  stroke={GROUP_COLORS[seg.group]}
                  strokeWidth={SW}
                  strokeDasharray={`${seg.dash} ${CIRC}`}
                  strokeDashoffset={seg.offset}
                  strokeLinecap="round"
                  className="cursor-pointer transition-opacity"
                  style={{ opacity: selected && selected !== seg.group ? 0.35 : 1 }}
                  onClick={() => setSelected(seg.group === selected ? null : seg.group)}
                />
              ))}
            </g>
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

      <div className="divide-y divide-navy/[0.05]">
        {segments.map((seg) => (
          <button
            key={seg.group}
            onClick={() => setSelected(seg.group === selected ? null : seg.group)}
            className={`w-full flex items-center gap-3 py-3 text-left transition-colors rounded-xl px-2 -mx-2 ${
              selected === seg.group ? "bg-navy/[0.03]" : "hover:bg-navy/[0.02]"
            }`}
          >
            <GroupIcon group={seg.group} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-navy truncate">{GROUP_LABELS[seg.group]}</p>
              <p className="text-xs text-navy/50">{seg.count} transacciones</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[13px] font-semibold text-navy tabular-nums">
                −{fmtAmount(seg.total)}
              </p>
              <p className="text-xs text-navy/50 tabular-nums">{pct(seg.share)}</p>
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
