"use client";

import { useMemo } from "react";
import type { StripePayment } from "@/lib/stripePayments";

const MONTH_LABELS: Record<string, string> = {
  "01":"Ene","02":"Feb","03":"Mar","04":"Abr",
  "05":"May","06":"Jun","07":"Jul","08":"Ago",
  "09":"Sep","10":"Oct","11":"Nov","12":"Dic",
};

const SVG_W = 900;
const SVG_H = 180;
const MT = 16;
const MR = 16;
const MB = 28;
const ML = 36;
const CHART_W = SVG_W - ML - MR;
const CHART_H = SVG_H - MT - MB;

export default function ClientesEvolucionChart({ payments }: { payments: StripePayment[] }) {
  const months = useMemo(() => {
    // Last 12 months
    const now = new Date();
    const result: { key: string; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      result.push({ key, label: MONTH_LABELS[key.slice(5)] ?? key.slice(5) });
    }
    return result;
  }, []);

  const data = useMemo(() => {
    const byMonth = new Map<string, Set<string>>();
    for (const p of payments) {
      if (!p.customerId) continue;
      const m = p.date.slice(0, 7);
      if (!byMonth.has(m)) byMonth.set(m, new Set());
      byMonth.get(m)!.add(p.customerId);
    }
    return months.map(({ key, label }) => ({
      key,
      label,
      count: byMonth.get(key)?.size ?? 0,
    }));
  }, [payments, months]);

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const yMax   = Math.ceil(maxVal / 5) * 5 || 5;
  const tickCount = Math.min(yMax, 5);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((yMax / tickCount) * i));

  const barW   = (CHART_W / data.length) * 0.55;
  const barGap = CHART_W / data.length;

  function barX(i: number) { return ML + i * barGap + (barGap - barW) / 2; }
  function barY(count: number) { return MT + CHART_H - (count / yMax) * CHART_H; }
  function barH(count: number) { return (count / yMax) * CHART_H; }

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-navy">Evolución de inscritos</h3>
          <p className="text-xs text-navy/45 mt-0.5">Clientes únicos con pago por mes · últimos 12 meses</p>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full"
          style={{ minWidth: "360px", height: "auto" }}
        >
          {/* Y grid + ticks */}
          {ticks.map((v) => {
            const y = MT + CHART_H - (v / yMax) * CHART_H;
            return (
              <g key={v}>
                <line x1={ML} y1={y} x2={SVG_W - MR} y2={y}
                  stroke="#1c191714" strokeWidth="1" strokeDasharray={v === 0 ? "none" : "3 3"} />
                <text x={ML - 6} y={y + 4} textAnchor="end"
                  className="fill-navy/40" style={{ fontSize: 11 }}>
                  {v}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {data.map((d, i) => {
            const x = barX(i);
            const h = barH(d.count);
            const y = barY(d.count);
            const isCurrent = d.key === currentMonth;
            const isEmpty = d.count === 0;
            return (
              <g key={d.key}>
                {/* Bar */}
                {!isEmpty && (
                  <rect
                    x={x} y={y} width={barW} height={h}
                    rx={4} ry={4}
                    fill={isCurrent ? "#6B7ED6" : "#6B7ED630"}
                    stroke={isCurrent ? "#6B7ED6" : "none"}
                    strokeWidth="1.5"
                  />
                )}
                {/* Value label on top */}
                {d.count > 0 && (
                  <text
                    x={x + barW / 2}
                    y={y - 5}
                    textAnchor="middle"
                    className={isCurrent ? "fill-primary font-semibold" : "fill-navy/50"}
                    style={{ fontSize: 11, fontWeight: isCurrent ? 600 : 400 }}
                  >
                    {d.count}
                  </text>
                )}
                {/* Month label */}
                <text
                  x={x + barW / 2}
                  y={SVG_H - 6}
                  textAnchor="middle"
                  style={{ fontSize: 11, fontWeight: isCurrent ? 600 : 400 }}
                  className={isCurrent ? "fill-navy" : "fill-navy/45"}
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
