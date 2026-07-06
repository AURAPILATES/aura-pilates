"use client";

import { useState, useMemo, useEffect } from "react";
import { BarChart2, Activity } from "react-feather";
import { occupancyByWeek, pct } from "@/lib/analytics";
import { MomenceEvent } from "@/lib/momence";
import type { BusinessEvent, EventCategoria } from "@/lib/businessEvents";
import { ChartCard, ChartTypeToggle, StaticLegend, InteractiveLegend } from "@/components/charts";

// Internal coordinate system for the SVG (bars + line + gridlines only — no text).
// Text labels are rendered as plain HTML overlays positioned with percentages,
// so font-size stays a real CSS pixel value at any screen width (no SVG-unit scaling).
const SVG_W = 600;
const SVG_H = 150;
const MT = 14; // headroom above tallest bar for event marker dot

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

const MONTH_LABELS: Record<string, string> = {
  "01":"Ene","02":"Feb","03":"Mar","04":"Abr",
  "05":"May","06":"Jun","07":"Jul","08":"Ago",
  "09":"Sep","10":"Oct","11":"Nov","12":"Dic",
};

function fmtEventDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTH_LABELS[m]} ${y}`;
}

export default function HorarioOcupacionEvolucion({
  events,
  businessEvents,
}: {
  events: MomenceEvent[];
  businessEvents?: BusinessEvent[];
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const data = useMemo(() => occupancyByWeek(events), [events]);

  const eventsByWeek = useMemo(() => {
    const map = new Map<string, BusinessEvent[]>();
    if (data.length === 0) return map;
    const weekStarts = data.map((d) => d.weekStart);
    for (const ev of (businessEvents ?? [])) {
      let closest: string | null = null;
      for (const ws of weekStarts) {
        if (ev.fecha >= ws && (closest === null || ws > closest)) closest = ws;
      }
      if (!closest) continue;
      const nextIdx = weekStarts.indexOf(closest) + 1;
      const nextWs = weekStarts[nextIdx];
      if (nextWs && ev.fecha >= nextWs) continue;
      if (!map.has(closest)) map.set(closest, []);
      map.get(closest)!.push(ev);
    }
    return map;
  }, [businessEvents, data]);

  const maxCapacity = Math.max(...data.map((d) => d.capacity), 1);
  const yMax = Math.ceil(maxCapacity / 10) * 10 || 10;
  const tickCount = isNarrow ? Math.min(yMax, 2) : Math.min(yMax, 5);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((yMax / tickCount) * i));

  const CHART_H = SVG_H - MT;
  const barW   = data.length > 0 ? (SVG_W / data.length) * 0.55 : 0;
  const barGap = data.length > 0 ? SVG_W / data.length : SVG_W;

  function barX(i: number) { return i * barGap + (barGap - barW) / 2; }
  function barCx(i: number) { return i * barGap + barGap / 2; }
  function valY(v: number) { return MT + CHART_H - (v / yMax) * CHART_H; }
  function valH(v: number) { return (v / yMax) * CHART_H; }
  function tickY(v: number) { return MT + CHART_H - (v / yMax) * CHART_H; }
  function occY(occ: number) { return MT + CHART_H - Math.min(occ, 1) * CHART_H; }

  function pctX(x: number) { return (x / SVG_W) * 100; }
  function pctY(y: number) { return (y / SVG_H) * 100; }

  const linePoints = data.map((d, i) => `${barCx(i)},${occY(d.occ)}`).join(" ");
  const soldLinePoints     = data.map((d, i) => `${barCx(i)},${valY(d.sold)}`).join(" ");
  const capacityLinePoints = data.map((d, i) => `${barCx(i)},${valY(d.capacity)}`).join(" ");

  const totalSold     = data.reduce((s, d) => s + d.sold, 0);
  const totalCapacity = data.reduce((s, d) => s + d.capacity, 0);
  const totalFree     = totalCapacity - totalSold;
  const avgOcc        = totalCapacity > 0 ? totalSold / totalCapacity : 0;

  if (data.length === 0) {
    return (
      <ChartCard title="Evolución de la ocupación" subtitle="Plazas vendidas vs. totales y % de ocupación por semana">
        <p className="text-sm text-navy/45 py-6 text-center">Sin datos suficientes para este período.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Evolución de la ocupación"
      subtitle="Plazas vendidas vs. totales y % de ocupación por semana"
      dataSource="Eventos activos en Momence, agrupados por semana"
      sources={["momence"]}
      toolbar={
        <div className="flex items-center gap-3 flex-wrap">
          <ChartTypeToggle
            value={chartType}
            onChange={(v) => setChartType(v as "bar" | "line")}
            options={[
              { value: "bar", label: "Ver como barras", icon: <BarChart2 size={14} /> },
              { value: "line", label: "Ver como línea", icon: <Activity size={14} /> },
            ]}
          />
          <StaticLegend
            items={[
              { label: "Plazas vendidas", color: "#3B4B9E", swatch: "dot" },
              { label: "Plazas libres", color: "#C0C6E8", swatch: "dot" },
              { label: "% ocupación", color: "#43884d", swatch: "line" },
            ]}
          />
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 min-w-0">
      <div className="flex items-stretch gap-2 mb-7">
        {/* Y-axis tick labels (plazas) — plain HTML, fixed CSS font size */}
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
            onMouseLeave={() => { setHoveredKey(null); setHoveredEventId(null); }}
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
              const evs = eventsByWeek.get(d.weekStart) ?? [];
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

            {chartType === "bar" ? (
              /* Stacked bars: sold (dark) + free (light) = capacity */
              data.map((d, i) => {
                const x = barX(i);
                const soldH = valH(d.sold);
                const soldY = valY(d.sold);
                const freeH = valH(d.capacity) - soldH;
                const isHov = hoveredKey === d.weekStart;
                return (
                  <g
                    key={d.weekStart}
                    onMouseEnter={() => setHoveredKey(d.weekStart)}
                    style={{ cursor: "default" }}
                  >
                    <rect x={x} y={MT} width={barW} height={CHART_H} fill="transparent" />
                    {d.capacity > 0 && (
                      <>
                        <rect x={x} y={soldY - freeH} width={barW} height={freeH} fill="#C0C6E8" opacity={isHov ? 1 : 0.85} />
                        <rect x={x} y={soldY} width={barW} height={soldH} fill="#3B4B9E" opacity={isHov ? 1 : 0.85} rx={soldH < 3 ? 0 : 2} />
                      </>
                    )}
                  </g>
                );
              })
            ) : (
              <>
                {/* Plazas totales (capacidad) y vendidas como líneas */}
                <polyline points={capacityLinePoints} fill="none" stroke="#C0C6E8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={soldLinePoints} fill="none" stroke="#3B4B9E" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {data.map((d, i) => (
                  <g key={d.weekStart} onMouseEnter={() => setHoveredKey(d.weekStart)} style={{ cursor: "default" }}>
                    <rect x={barX(i)} y={MT} width={barW} height={CHART_H} fill="transparent" />
                    <circle cx={barCx(i)} cy={valY(d.capacity)} r={hoveredKey === d.weekStart ? 4 : 2.5} fill="#C0C6E8" stroke="white" strokeWidth="1" />
                    <circle cx={barCx(i)} cy={valY(d.sold)} r={hoveredKey === d.weekStart ? 4 : 2.5} fill="#3B4B9E" stroke="white" strokeWidth="1" />
                  </g>
                ))}
              </>
            )}

            {/* Occupancy % line */}
            <polyline points={linePoints} fill="none" stroke="#43884d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {data.map((d, i) => (
              <circle
                key={`dot-${d.weekStart}`}
                cx={barCx(i)} cy={occY(d.occ)}
                r={hoveredKey === d.weekStart ? 4 : 2.5}
                fill="#43884d" stroke="white" strokeWidth="1"
              />
            ))}

            {/* Hover tooltip */}
            {hoveredKey && (() => {
              const i = data.findIndex((d) => d.weekStart === hoveredKey);
              if (i === -1) return null;
              const d = data[i];
              const TW = 130, TH = 50;
              const cx = barCx(i);
              const flipL = cx + TW + 10 > SVG_W;
              const tx = flipL ? cx - TW - 10 : cx + 10;
              const ty = Math.max(MT, Math.min(occY(d.occ), valY(d.sold)) - 10);
              return (
                <g pointerEvents="none">
                  <rect x={tx} y={ty} width={TW} height={TH} rx="6"
                    fill="white" stroke="#E2E8F0" strokeWidth="1"
                    style={{ filter: "drop-shadow(0 2px 6px rgba(15,23,42,0.10))" }}
                  />
                  <text x={tx + 8} y={ty + 14} fontSize="9" fontWeight="700" fill="#0F172A">{d.label}</text>
                  <text x={tx + 8} y={ty + 28} fontSize="8.5" fill="#64748B">{d.sold}/{d.capacity} plazas</text>
                  <text x={tx + 8} y={ty + 41} fontSize="8.5" fontWeight="600" fill="#43884d">{Math.round(d.occ * 100)}% ocupación</text>
                </g>
              );
            })()}

            {/* Event markers + tooltips — rendered last (on top) */}
            {data.map((d, i) => {
              const evs = eventsByWeek.get(d.weekStart) ?? [];
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
                    <rect x={cx - 8} y={MT - 10} width={16} height={CHART_H + 20} fill="transparent" />
                    <circle
                      cx={cx} cy={MT - 2}
                      r={isHov ? 5 : 3.5}
                      fill={color}
                      stroke="white"
                      strokeWidth={isHov ? 1.5 : 1}
                      opacity={isHov ? 1 : 0.8}
                    />
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

          {/* Week labels — plain HTML, fixed CSS font size */}
          {data.map((d, i) => {
            if (data.length > 14 && i % 2 === 1) return null; // thin out labels on long ranges
            return (
              <div
                key={`wk-${d.weekStart}`}
                className="absolute text-[10px] text-navy/45 leading-none whitespace-nowrap"
                style={{
                  left: `${pctX(barCx(i))}%`,
                  top: "100%",
                  transform: "translate(-50%, 8px)",
                }}
              >
                {d.label}
              </div>
            );
          })}
        </div>
      </div>
        </div>

        <div className="lg:col-span-1 min-w-0">
          <p className="text-xs font-medium text-navy/55 mb-2.5">Resumen</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-navy/5 mb-4">
            <div style={{ flex: `${totalCapacity > 0 ? totalSold / totalCapacity : 0} 0 0%`, backgroundColor: "#3B4B9E" }} />
            <div style={{ flex: `${totalCapacity > 0 ? totalFree / totalCapacity : 0} 0 0%`, backgroundColor: "#C0C6E8" }} />
          </div>
          <InteractiveLegend
            items={[
              { key: "sold", label: "Plazas vendidas", color: "#3B4B9E", value: totalSold, helper: pct(avgOcc) },
              { key: "free", label: "Plazas libres", color: "#C0C6E8", value: totalFree },
            ]}
          />
        </div>
      </div>
    </ChartCard>
  );
}
