"use client";

import { useState, useMemo, useEffect } from "react";
import type { StripePayment } from "@/lib/stripePayments";
import type { BusinessEvent, EventCategoria } from "@/lib/businessEvents";

const MONTH_LABELS: Record<string, string> = {
  "01":"Ene","02":"Feb","03":"Mar","04":"Abr",
  "05":"May","06":"Jun","07":"Jul","08":"Ago",
  "09":"Sep","10":"Oct","11":"Nov","12":"Dic",
};

const SVG_W = 680;
const SVG_H = 180;
const MT = 16;
const MR = 16;
const MB = 28;
const ML = 36;
const CHART_W = SVG_W - ML - MR;
const CHART_H = SVG_H - MT - MB;

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
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const valueFontSize = isMobile ? 18 : 11;
  const monthFontSize = isMobile ? 17 : 11;

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

  const barW   = (CHART_W / data.length) * 0.55;
  const barGap = CHART_W / data.length;

  function barX(i: number) { return ML + i * barGap + (barGap - barW) / 2; }
  function barCx(i: number) { return ML + i * barGap + barGap / 2; }
  function barY(count: number) { return MT + CHART_H - (count / yMax) * CHART_H; }
  function barH(count: number) { return (count / yMax) * CHART_H; }

  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-navy">Evolución de inscritos</h3>
          <p className="text-xs text-navy/45 mt-0.5">Clientes únicos con pago por mes · desde apertura</p>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full"
          style={{ minWidth: "360px", height: "auto" }}
          onMouseLeave={() => setHoveredEventId(null)}
        >
          {/* Y grid + ticks */}
          {ticks.map((v) => {
            const y = MT + CHART_H - (v / yMax) * CHART_H;
            return (
              <g key={v}>
                <line x1={ML} y1={y} x2={SVG_W - MR} y2={y}
                  stroke="#1c191714" strokeWidth="1" strokeDasharray={v === 0 ? "none" : "3 3"} />
                <text x={ML - 6} y={y + 4} textAnchor="end"
                  className="fill-navy/40" style={{ fontSize: 12 }}>
                  {v}
                </text>
              </g>
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
                <rect x={x} y={MT} width={barW} height={CHART_H} rx={4} fill="transparent" />
                {/* Bar */}
                {d.count > 0 && (
                  <rect x={x} y={y} width={barW} height={h} rx={4} ry={4} fill={fill} />
                )}
                {/* Value label on top */}
                {d.count > 0 && (
                  <text
                    x={x + barW / 2} y={y - 5} textAnchor="middle"
                    style={{ fontSize: valueFontSize, fontWeight: isCurrent || isActive ? 700 : 500, fill: isActive ? "#3B4B9E" : isCurrent ? "#6B7ED6" : "#7B84A8" }}
                  >
                    {d.count}
                  </text>
                )}
                {/* Month label */}
                <text
                  x={x + barW / 2} y={SVG_H - 5} textAnchor="middle"
                  style={{ fontSize: monthFontSize, fontWeight: isCurrent || isActive ? 700 : 400, fill: isActive ? "#3B4B9E" : isCurrent ? "#1C1917" : "#94A3B8" }}
                >
                  {d.label}
                </text>
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
              const EV_TW = 195;
              const EV_TH = ev.descripcion ? 58 : 44;
              const flipL = cx + EV_TW + 10 > SVG_W - MR;
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
                      <circle cx={tx + 14} cy={MT + 13} r="3.5" fill={color} />
                      <text x={tx + 24} y={MT + 17} fontSize="9" fontWeight="600" fill={color}>
                        {EVENT_LABELS[ev.categoria]}
                      </text>
                      <text x={tx + EV_TW - 10} y={MT + 17} fontSize="8.5" fill="#94A3B8" textAnchor="end">
                        {fmtEventDate(ev.fecha)}
                      </text>
                      <text x={tx + 10} y={MT + 31} fontSize="9.5" fontWeight="600" fill="#0F172A">
                        {ev.titulo.length > 28 ? ev.titulo.slice(0, 28) + "…" : ev.titulo}
                      </text>
                      {ev.descripcion && (
                        <text x={tx + 10} y={MT + 46} fontSize="8.5" fill="#64748B">
                          {ev.descripcion.length > 34 ? ev.descripcion.slice(0, 34) + "…" : ev.descripcion}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            });
          })}
        </svg>
      </div>
    </div>
  );
}
