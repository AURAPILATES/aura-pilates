"use client";
import { useState } from "react";
import Drawer from "@/app/components/Drawer";
import { InteractiveLegend } from "@/components/charts";
import type { EconomicGroup } from "@/lib/transactions";

type Txn = { date: string; amount: number; concept: string; contact: string };

export type GroupTotal = { group: EconomicGroup; total: number; count: number; txns: Txn[] };

export const GROUP_LABELS: Record<EconomicGroup, string> = {
  personal: "Personal",
  operational: "Operativo",
  capex: "Inversión",
};

export const GROUP_COLORS: Record<EconomicGroup, string> = {
  personal: "#3A56C5",
  operational: "#1E8C5A",
  capex: "#D4621A",
};

export const GROUP_ORDER: EconomicGroup[] = ["personal", "operational", "capex"];

export function fmtAmount(n: number) {
  // "es-ES" solo agrupa millares a partir de 5 cifras (quirk de CLDR); "de-DE" usa el
  // mismo separador (punto) pero agrupa siempre a partir de 1000, dando un formato consistente.
  return Math.round(n).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
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
  hiddenGroups,
  onToggleHidden,
}: {
  groups: GroupTotal[];
  totalExpCat: number;
  hiddenGroups?: Set<EconomicGroup>;
  onToggleHidden?: (group: EconomicGroup) => void;
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
            style={{ flex: `${seg.share} 0 0%`, backgroundColor: GROUP_COLORS[seg.group] }}
          />
        ))}
      </div>

      <InteractiveLegend
        className="mt-4"
        items={segments.map((seg) => ({
          key: seg.group,
          label: GROUP_LABELS[seg.group],
          color: GROUP_COLORS[seg.group],
          value: fmtAmount(seg.total),
          helper: pct(seg.share),
          hidden: hiddenGroups?.has(seg.group),
        }))}
        onSelect={(key) => setSelected(key === selected ? null : (key as EconomicGroup))}
        onToggleVisibility={onToggleHidden ? (key) => onToggleHidden(key as EconomicGroup) : undefined}
      />

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
