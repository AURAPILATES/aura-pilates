"use client";
import { useState } from "react";
import Drawer from "@/app/components/Drawer";
import type { EconomicGroup } from "@/lib/transactions";

type Txn = { date: string; amount: number; concept: string; contact: string };

export type GroupTotal = { group: EconomicGroup; total: number; count: number; txns: Txn[] };

export const GROUP_LABELS: Record<EconomicGroup, string> = {
  personal: "Personal",
  operational: "Gasto operativo (OpEx)",
  capex: "Inversión (CapEx)",
};

export const GROUP_COLORS: Record<EconomicGroup, string> = {
  personal: "#3A56C5",
  operational: "#1E8C5A",
  capex: "#D4621A",
};

export const GROUP_ORDER: EconomicGroup[] = ["personal", "operational", "capex"];

export function fmtAmount(n: number) {
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
}: {
  groups: GroupTotal[];
  totalExpCat: number;
}) {
  const [selected, setSelected] = useState<EconomicGroup | null>(null);

  const ordered = GROUP_ORDER.map((g) => groups.find((x) => x.group === g)).filter((g): g is GroupTotal => !!g && g.total > 0);

  const segments = ordered.map((g) => {
    const share = totalExpCat > 0 ? g.total / totalExpCat : 0;
    return { ...g, share };
  });

  const selectedSeg  = segments.find((s) => s.group === selected) ?? null;
  const selectedTxns = selectedSeg
    ? [...selectedSeg.txns].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <>
      <div className="flex h-3 rounded-full overflow-hidden bg-navy/5">
        {segments.map((seg) => (
          <div
            key={seg.group}
            style={{ width: `${seg.share * 100}%`, backgroundColor: GROUP_COLORS[seg.group] }}
          />
        ))}
      </div>

      <div className="mt-4 space-y-0.5">
        {segments.map((seg) => (
          <button
            key={seg.group}
            onClick={() => setSelected(seg.group === selected ? null : seg.group)}
            className={`w-full flex items-center gap-2.5 text-left transition-colors rounded-xl px-2 py-2 -mx-2 ${
              selected === seg.group ? "bg-navy/[0.03]" : "hover:bg-navy/[0.02]"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: GROUP_COLORS[seg.group] }} />
            <span className="text-[13px] font-medium text-navy flex-1 min-w-0 truncate">{GROUP_LABELS[seg.group]}</span>
            <span className="text-[13px] font-semibold text-navy tabular-nums shrink-0">−{fmtAmount(seg.total)}</span>
            <span className="text-xs text-navy/50 tabular-nums shrink-0 w-10 text-right">{pct(seg.share)}</span>
          </button>
        ))}
      </div>

      {selected && selectedSeg && (
        <Drawer
          maxWidth="max-w-[420px]"
          header={
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: GROUP_COLORS[selectedSeg.group] }} />
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
