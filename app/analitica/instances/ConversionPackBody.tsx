"use client";

import { useMemo, useState } from "react";
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
import { StaticLegend, CollapsibleTable } from "@/components/charts";
import Drawer from "@/app/components/Drawer";
import { analyzeCohorts, type CohortAnalysis } from "./conversionAnalysis";

const PRIMARY = "#4021c8";
const DANGER = "#B85C6E";

function fmtPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDate(d: string) {
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

function ConversionTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload as CohortAnalysis;
  return (
    <div className="bg-card border border-border rounded-[10px] shadow-lg px-3 py-2 text-xs max-w-[220px]">
      <p className="font-semibold text-navy mb-1">{c.label}</p>
      <p className="text-navy/55">{c.converted} / {c.buyers} convertidos</p>
      <p className="font-semibold" style={{ color: c.unreliable ? DANGER : PRIMARY }}>{fmtPct(c.rate)}</p>
      {c.immature && (
        <p className="text-[11px] text-danger mt-1.5 leading-snug">Mes dentro de la ventana de conversión — tasa todavía provisional.</p>
      )}
      {!c.immature && c.lowConfidence && (
        <p className="text-[11px] text-danger mt-1.5 leading-snug">Muestra insuficiente para ser concluyente.</p>
      )}
    </div>
  );
}

function XAxisTick({
  x, y, payload, rowsByLabel,
}: {
  x?: string | number;
  y?: string | number;
  payload?: { value: string };
  rowsByLabel: Map<string, CohortAnalysis>;
}) {
  if (x === undefined || y === undefined || !payload) return null;
  const row = rowsByLabel.get(payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={10} textAnchor="middle" fontSize={10} fill="rgba(28,25,23,0.45)">{payload.value}</text>
      {row && (
        <text x={0} y={0} dy={23} textAnchor="middle" fontSize={9} fill={row.unreliable ? DANGER : "rgba(28,25,23,0.35)"}>
          {`n=${row.buyers}`}
        </text>
      )}
    </g>
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
  const { cohorts, rate, medianDaysToConvert } = summary;

  const today = useMemo(() => new Date(), []);
  const rows = useMemo(() => analyzeCohorts(cohorts, medianDaysToConvert, today), [cohorts, medianDaysToConvert, today]);
  const rowsByLabel = useMemo(() => new Map(rows.map((r) => [r.label, r])), [rows]);

  // Línea sólida hasta el último mes maduro; a partir de ahí, discontinua (incluye el punto
  // de empalme para que ambos tramos se toquen visualmente sin duplicar el punto).
  const firstImmatureIdx = rows.findIndex((r) => r.immature);
  const matureEndIdx = firstImmatureIdx === -1 ? rows.length - 1 : firstImmatureIdx - 1;
  const chartRows = rows.map((r, i) => ({
    ...r,
    rateMature: i <= matureEndIdx ? r.rate : null,
    rateImmature: i >= matureEndIdx ? r.rate : null,
  }));

  if (cohorts.length === 0) {
    return <p className="text-sm text-navy/45 text-center py-10">Sin compras del pack registradas</p>;
  }

  return (
    <>
      <StaticLegend
        className="mb-3"
        items={[
          { label: "% conversión", color: PRIMARY, swatch: "line" },
          { label: `Media ${fmtPct(rate)}`, color: PRIMARY, swatch: "dashed" },
          { label: "Mes parcial", color: DANGER, swatch: "dashed" },
          { label: "Confianza baja", color: DANGER, swatch: "dot" },
        ]}
      />

      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartRows} margin={{ top: 8, right: 28, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="4 3" stroke="rgba(28,25,23,0.07)" vertical={false} />
            <XAxis
              dataKey="label"
              height={34}
              tickLine={false}
              axisLine={false}
              tick={(props) => <XAxisTick {...props} rowsByLabel={rowsByLabel} />}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={fmtPct}
              tick={{ fontSize: 10, fill: "rgba(28,25,23,0.45)" }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <ReferenceLine
              y={rate}
              stroke={PRIMARY}
              strokeDasharray="6 3"
              strokeOpacity={0.5}
              label={{ value: fmtPct(rate).replace("%", "").split(".")[0], position: "right", fontSize: 10, fill: PRIMARY }}
            />
            <Tooltip content={ConversionTooltip} />
            <Line
              type="monotone"
              dataKey="rateMature"
              stroke={PRIMARY}
              strokeWidth={2}
              connectNulls={false}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (cx === undefined || cy === undefined || index === undefined) return <g key={index} />;
                const row = rows[index];
                if (!row || row.immature) return <g key={index} />;
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={row.lowConfidence ? DANGER : PRIMARY}
                    stroke="var(--color-card)"
                    strokeWidth={1.5}
                    className="cursor-pointer"
                    onClick={() => setSelectedCohort(cohorts[index])}
                  />
                );
              }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="rateImmature"
              stroke={DANGER}
              strokeWidth={2}
              strokeDasharray="6 3"
              connectNulls={false}
              dot={(props: { cx?: number; cy?: number; index?: number }) => {
                const { cx, cy, index } = props;
                if (cx === undefined || cy === undefined || index === undefined) return <g key={index} />;
                const row = rows[index];
                if (!row || !row.immature) return <g key={index} />;
                return (
                  <circle
                    key={index}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={DANGER}
                    stroke="var(--color-card)"
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

      <CollapsibleTable>
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
            {rows.map((c) => (
              <tr
                key={c.month}
                onClick={() => setSelectedCohort(c)}
                className="border-b border-navy/[0.04] last:border-0 cursor-pointer hover:bg-navy/[0.02] transition-colors"
              >
                <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    {c.unreliable && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: DANGER }} />}
                    {c.label}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{c.buyers}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{c.converted}</td>
                <td className={`py-2 text-right font-semibold tabular-nums ${c.unreliable ? "text-danger" : "text-navy"}`}>{fmtPct(c.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleTable>

      {selectedCohort && <CohortDrawer cohort={selectedCohort} onClose={() => setSelectedCohort(null)} />}
    </>
  );
}
