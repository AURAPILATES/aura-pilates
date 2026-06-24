"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  type TooltipContentProps,
} from "recharts";
import type { ConversionCohort, ConversionSummary } from "@/lib/sales";
import Drawer from "@/app/components/Drawer";

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDate(d: string) {
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

function ConversionTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload as ConversionCohort;
  return (
    <div className="bg-white border border-navy/[0.07] rounded-lg shadow-card px-3 py-2 text-xs">
      <p className="font-semibold text-navy mb-1">{c.label}</p>
      <p className="text-navy/55">{c.converted} / {c.buyers} convertidos</p>
      <p className="font-semibold text-primary">{fmtPct(c.rate)}</p>
    </div>
  );
}

function CohortDrawer({ cohort, onClose }: { cohort: ConversionCohort; onClose: () => void }) {
  return (
    <Drawer
      title={cohort.label}
      subtitle={`${cohort.converted} de ${cohort.buyers} convertidos (${fmtPct(cohort.rate)})`}
      onClose={onClose}
    >
      <div className="px-6 py-4 space-y-2">
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
                  Convertido {b.convertedDate ? fmtDate(b.convertedDate) : ""} ({b.daysToConvert}d)
                </span>
              ) : b.boughtOtherPack ? (
                <span className="shrink-0 text-xs font-semibold text-warning bg-warning/10 px-2 py-1 rounded-full">
                  Otro pack {b.otherPackDate ? fmtDate(b.otherPackDate) : ""}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-navy/40 bg-navy/[0.04] px-2 py-1 rounded-full">Sin convertir</span>
              )}
            </div>
          ))}
      </div>
    </Drawer>
  );
}

export default function ConversionPackBody({ summary }: { summary: ConversionSummary }) {
  const [selectedCohort, setSelectedCohort] = useState<ConversionCohort | null>(null);
  const { cohorts, rate } = summary;

  if (cohorts.length === 0) {
    return <p className="text-sm text-navy/45 text-center py-10">Sin compras del pack registradas</p>;
  }

  return (
    <>
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={cohorts} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="4 3" stroke="rgba(28,25,23,0.07)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }} tickLine={false} axisLine={false} />
            <YAxis
              domain={[0, 1]}
              tickFormatter={fmtPct}
              tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <ReferenceLine y={rate} stroke="#4021c8" strokeDasharray="6 3" strokeOpacity={0.5} />
            <Tooltip content={ConversionTooltip} />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#4021c8"
              strokeWidth={2}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (cx === undefined || cy === undefined || index === undefined) return <g key={index} />;
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="#4021c8"
                    stroke="white"
                    strokeWidth={1.5}
                    className="cursor-pointer"
                    onClick={() => setSelectedCohort(cohorts[index])}
                  />
                );
              }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr className="border-b border-navy/[0.07]">
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
                <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">{c.label}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{c.buyers}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{c.converted}</td>
                <td className="py-2 text-right font-semibold text-navy tabular-nums">{fmtPct(c.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCohort && <CohortDrawer cohort={selectedCohort} onClose={() => setSelectedCohort(null)} />}
    </>
  );
}
