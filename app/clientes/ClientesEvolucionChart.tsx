"use client";

import { useState, useMemo } from "react";
import type { StripePayment } from "@/lib/stripePayments";
import type { BusinessEvent, EventCategoria } from "@/lib/businessEvents";

const MONTH_LABELS: Record<string, string> = {
  "01":"Ene","02":"Feb","03":"Mar","04":"Abr",
  "05":"May","06":"Jun","07":"Jul","08":"Ago",
  "09":"Sep","10":"Oct","11":"Nov","12":"Dic",
};

// Internal coordinate system for the SVG (bars + gridlines only — no text).
// Text labels are rendered as plain HTML overlays positioned with percentages,
// so font-size stays a real CSS pixel value at any screen width (no SVG-unit scaling).
const SVG_W = 600;
const SVG_H = 130;
const MT = 14; // headroom above tallest bar for event marker dot

// ── Event annotation config ───────────────────────────────────────────────────

const EVENT_COLORS: Record<EventCategoria, string> = {
  precios:     "#F59E0B",
  horarios:    "#3B82F6",
  promociones: "#10B981",
  operativo:   "#A855F7",
  otro:        "#64748B",
};

const EVENT_LABELS: Record<EventCategoria, string> = {
  precios:     "Precios",
  horarios:    "Horarios",
  promociones: "Promociones",
  operativo:   "Operativo",
  otro:        "Otro",
};

function fmtEventDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTH_LABELS[m]} ${y}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientesEvolucionChart({
  payments,
  onBarClick,
  activeMonth,
  events,
}: {
  payments: StripePayment[];
  onBarClick?: (month: string) => void;
  activeMonth?: string | null;
  events?: BusinessEvent[];
}) {
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  const months = useMemo(() => {
    const now = new Date();
    const start = new Date(2026, 1, 1); // Feb 2026 — apertura del centro
    const result: { key: string; label: string }[] = [];
    const cur = new Date(start);
    while (cur <= now) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      result.push({ key, label: MONTH_LABELS[key.slice(5)] ?? key.slice(5) });
      cur.setMonth(cur.getMonth() + 1);
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

  // Group events by month (only those within the visible 12-month window)
  const visibleMonthKeys = useMemo(() => new Set(months.map((m) => m.key)), [months]);
  const eventsByMonth = useMemo(() => {
    const map = new Map<string, BusinessEvent[]>();
    for (const ev of (events ?? [])) {
      const m = ev.fecha.slice(0, 7);
      if (!visibleMonthKeys.has(m)) continue;
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(ev);
    }
    return map;
  }, [events, visibleMonthKeys]);

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const yMax   = Math.ceil(maxVal / 5) * 5 || 5;
  const tickCount = Math.min(yMax, 5);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((yMax / tickCount) * i));

  const CHART_H = SVG_H - MT;
  const barW   = (SVG_W / data.length) * 0.55;
  const barGap = SVG_W / data.length;

  function barX(i: number) { return i * barGap + (barGap - barW) / 2; }
  function barCx(i: number) { return i * barGap + barGap / 2; }
  function barY(count: number) { return MT + CHART_H - (count / yMax) * CHART_H; }
  function barH(count: number) { return (count / yMax) * CHART_H; }
  function tickY(v: number) { return MT + CHART_H - (v / yMax) * CHART_H; }

  function pctX(x: number) { return (x / SVG_W) * 100; }
  function pctY(y: number) { return (y / SVG_H) * 100; }

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-navy">Evolución de inscritos</h3>
          <p className="text-xs text-navy/45 mt-0.5">Clientes únicos con pago por mes · desde apertura</p>
        </div>
      </div>

      <div className="flex items-stretch gap-2 mb-7">
        {/* Y-axis tick labels — plain HTML, fixed CSS font size, never scales */}
        <div className="relative w-7 shrink-0">
          {ticks.map((v) => (
            <div
              key={v}
              className="absolute right-0 text-[11px] text-navy/40 leading-none"
              style={{ top: `${pctY(tickY(v))}%`, transform: "translateY(-50%)" }}
            >
              {v}
            </div>
          ))}
        </div>

        {/* Chart area: SVG (shapes only) + HTML label overlays */}
        <div className="relative flex-1" style={{ aspectRatio: `${SVG_W} / ${SVG_H}` }}>
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="none"
            onMouseLeave={() => setHoveredEventId(null)}
          >
            {/* Y grid lines */}
            {ticks.map((v) => {
              const y = tickY(v);
              return (
                <line key={v} x1={0} y1={y} x2={SVG_W} y2={y}
                  stroke="#1c191714" strokeWidth="1" strokeDasharray={v === 0 ? "none" : "3 3"} />
              );
            })}

            {/* Event annotation lines — behind bars */}
            {data.map((d, i) => {
              const evs = eventsByMonth.get(d.key) ?? [];
              return evs.map((ev, ei) => {
                const cx = evs.length > 1 ? barCx(i) + (ei - (evs.length - 1) / 2) * 7 : barCx(i);
                return (
                  <line
                    key={`evline-${ev.id}`}
                    x1={cx} y1={MT} x2={cx} y2={MT + CHART_H}
                    stroke={EVENT_COLORS[ev.categoria]}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.4"
                    pointerEvents="none"
                  />
                );
              });
            })}

            {/* Bars */}
            {data.map((d, i) => {
              const x = barX(i);
              const h = barH(d.count);
              const y = barY(d.count);
              const isCurrent = d.key === currentMonth;
              const isActive  = d.key === activeMonth;
              const fill = isActive ? "#3B4B9E" : isCurrent ? "#6B7ED6" : "#C0C6E8";
              return (
                <g
                  key={d.key}
                  onClick={() => onBarClick?.(d.key)}
                  style={{ cursor: onBarClick ? "pointer" : "default" }}
                >
                  {/* Invisible hit area */}
                  <rect x={x} y={MT} width={barW} height={CHART_H} fill="transparent" />
                  {/* Bar */}
                  {d.count > 0 && (
                    <rect x={x} y={y} width={barW} height={h} rx={4} ry={4} fill={fill} />
                  )}
                </g>
              );
            })}

            {/* Event markers + tooltips — rendered last (on top) */}
            {data.map((d, i) => {
              const evs = eventsByMonth.get(d.key) ?? [];
              return evs.map((ev, ei) => {
                const cx    = evs.length > 1 ? barCx(i) + (ei - (evs.length - 1) / 2) * 7 : barCx(i);
                const color = EVENT_COLORS[ev.categoria];
                const isHov = hoveredEventId === ev.id;
                const EV_TW = 170;
                const EV_TH = ev.descripcion ? 50 : 38;
                const flipL = cx + EV_TW + 10 > SVG_W;
                const tx    = flipL ? cx - EV_TW - 10 : cx + 10;

                return (
                  <g
                    key={`evmark-${ev.id}`}
                    onMouseEnter={() => setHoveredEventId(ev.id)}
                    onMouseLeave={() => setHoveredEventId(null)}
                    style={{ cursor: "default" }}
                  >
                    {/* Hitbox */}
                    <rect x={cx - 8} y={MT - 10} width={16} height={CHART_H + 20} fill="transparent" />
                    {/* Marker dot */}
                    <circle
                      cx={cx} cy={MT - 2}
                      r={isHov ? 5 : 3.5}
                      fill={color}
                      stroke="white"
                      strokeWidth={isHov ? 1.5 : 1}
                      opacity={isHov ? 1 : 0.8}
                    />
                    {/* Tooltip */}
                    {isHov && (
                      <g pointerEvents="none">
                        <rect x={tx} y={MT} width={EV_TW} height={EV_TH} rx="6"
                          fill="white" stroke="#E2E8F0" strokeWidth="1"
                          style={{ filter: "drop-shadow(0 2px 6px rgba(15,23,42,0.10))" }}
                        />
                        <circle cx={tx + 12} cy={MT + 11} r="3" fill={color} />
                        <text x={tx + 20} y={MT + 14} fontSize="8" fontWeight="600" fill={color}>
                          {EVENT_LABELS[ev.categoria]}
                        </text>
                        <text x={tx + EV_TW - 8} y={MT + 14} fontSize="7.5" fill="#94A3B8" textAnchor="end">
                          {fmtEventDate(ev.fecha)}
                        </text>
                        <text x={tx + 8} y={MT + 26} fontSize="8.5" fontWeight="600" fill="#0F172A">
                          {ev.titulo.length > 24 ? ev.titulo.slice(0, 24) + "…" : ev.titulo}
                        </text>
                        {ev.descripcion && (
                          <text x={tx + 8} y={MT + 38} fontSize="7.5" fill="#64748B">
                            {ev.descripcion.length > 30 ? ev.descripcion.slice(0, 30) + "…" : ev.descripcion}
                          </text>
                        )}
                      </g>
                    )}
                  </g>
                );
              });
            })}
          </svg>

          {/* Value labels — plain HTML, fixed CSS font size */}
          {data.map((d, i) => {
            if (d.count === 0) return null;
            const isCurrent = d.key === currentMonth;
            const isActive  = d.key === activeMonth;
            return (
              <div
                key={`val-${d.key}`}
                className="absolute text-xs leading-none whitespace-nowrap"
                style={{
                  left: `${pctX(barCx(i))}%`,
                  top: `${pctY(barY(d.count))}%`,
                  transform: "translate(-50%, calc(-100% - 4px))",
                  fontWeight: isCurrent || isActive ? 700 : 500,
                  color: isActive ? "#3B4B9E" : isCurrent ? "#6B7ED6" : "#7B84A8",
                }}
              >
                {d.count}
              </div>
            );
          })}

          {/* Month labels — plain HTML, fixed CSS font size */}
          {data.map((d, i) => {
            const isCurrent = d.key === currentMonth;
            const isActive  = d.key === activeMonth;
            return (
              <div
                key={`mon-${d.key}`}
                onClick={() => onBarClick?.(d.key)}
                className="absolute text-xs leading-none whitespace-nowrap"
                style={{
                  left: `${pctX(barCx(i))}%`,
                  top: "100%",
                  transform: "translate(-50%, 8px)",
                  fontWeight: isCurrent || isActive ? 700 : 400,
                  color: isActive ? "#3B4B9E" : isCurrent ? "#1C1917" : "#94A3B8",
                  cursor: onBarClick ? "pointer" : "default",
                }}
              >
                {d.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
