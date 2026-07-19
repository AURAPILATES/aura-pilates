"use client";

import { useState, useMemo, useEffect } from "react";
import { BarChart2, Activity } from "react-feather";
import { occupancyByPeriod, occupancyPeriodKey, pct, type OccupancyPeriod } from "@/lib/analytics";
import { MomenceEvent } from "@/lib/momence";
import type { BusinessEvent, EventCategoria } from "@/lib/businessEvents";
import { ChartCard, ChartTypeToggle, ToggleGroup, StaticLegend, InteractiveLegend } from "@/components/charts";

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

const PERIODS: { key: OccupancyPeriod; label: string }[] = [
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año", label: "Año" },
];

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
  const [period, setPeriod] = useState<OccupancyPeriod>("semana");

  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const data = useMemo(() => occupancyByPeriod(events, period), [events, period]);

  const eventsByPeriod = useMemo(() => {
    const map = new Map<string, BusinessEvent[]>();
    for (const ev of (businessEvents ?? [])) {
      const key = occupancyPeriodKey(ev.fecha, period);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [businessEvents, period]);

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

  const periodLabelLower = PERIODS.find((p) => p.key === period)!.label.toLowerCase();

  if (data.length === 0) {
    return (
      <ChartCard title="Evolución de la ocupación" subtitle={`Plazas vendidas vs. totales y % de ocupación por ${periodLabelLower}`}>
        <p className="text-sm text-navy/45 py-6 text-center">Sin datos suficientes para este período.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Evolución de la ocupación"
      subtitle={`Plazas vendidas vs. totales y % de ocupación por ${periodLabelLower}`}
      dataSource={`Eventos activos en Momence, agrupados por ${periodLabelLower}`}
      sources={["momence"]}
      toolbar={
        <>
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
          <ToggleGroup
            value={period}
            onChange={(v) => setPeriod(v as OccupancyPeriod)}
            options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </>
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
                  stroke="#1c191714" strokeWidth="1" strokeDasharray={v === 0 ? "none" : "3 3"} vectorEffect="non-scaling-stroke" />
              );
            })}

            {/* Event annotation lines — behind bars */}
            {data.map((d, i) => {
              const evs = eventsByPeriod.get(d.key) ?? [];
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
                    vectorEffect="non-scaling-stroke"
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
                const isHov = hoveredKey === d.key;
                return (
                  <g
                    key={d.key}
                    onMouseEnter={() => setHoveredKey(d.key)}
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
                <polyline points={capacityLinePoints} fill="none" stroke="#C0C6E8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <polyline points={soldLinePoints} fill="none" stroke="#3B4B9E" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {data.map((d, i) => (
                  <g key={d.key} onMouseEnter={() => setHoveredKey(d.key)} style={{ cursor: "default" }}>
                    <rect x={barX(i)} y={MT} width={barW} height={CHART_H} fill="transparent" />
                    <circle cx={barCx(i)} cy={valY(d.capacity)} r={hoveredKey === d.key ? 4 : 2.5} fill="#C0C6E8" stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    <circle cx={barCx(i)} cy={valY(d.sold)} r={hoveredKey === d.key ? 4 : 2.5} fill="#3B4B9E" stroke="white" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  </g>
                ))}
              </>
            )}

            {/* Occupancy % line */}
            <polyline points={linePoints} fill="none" stroke="#43884d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {data.map((d, i) => (
              <circle
                key={`dot-${d.key}`}
                cx={barCx(i)} cy={occY(d.occ)}
                r={hoveredKey === d.key ? 4 : 2.5}
                fill="#43884d" stroke="white" strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {/* Event markers — rendered last (on top); tooltip content is an HTML overlay below */}
            {data.map((d, i) => {
              const evs = eventsByPeriod.get(d.key) ?? [];
              return evs.map((ev, ei) => {
                const cx    = evs.length > 1 ? barCx(i) + (ei - (evs.length - 1) / 2) * 7 : barCx(i);
                const color = EVENT_COLORS[ev.categoria];
                const isHov = hoveredEventId === ev.id;

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
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              });
            })}
          </svg>

          {/* Hover tooltip — plain HTML overlay positioned by %, so text stays a real CSS px
              size instead of scaling with the SVG viewBox (same reasoning as the axis/week
              labels below: avoids the thicker-lines/oversized-text look vs. the Recharts-based
              charts elsewhere in Analítica). */}
          {hoveredKey && (() => {
            const i = data.findIndex((d) => d.key === hoveredKey);
            if (i === -1) return null;
            const d = data[i];
            const cx = barCx(i);
            const anchorY = Math.min(valY(d.sold), occY(d.occ));
            const flipL = pctX(cx) > 70;
            return (
              <div
                className="absolute z-10 bg-white border border-[#e6e6ea] rounded-[10px] shadow-lg px-3 py-2 text-xs leading-snug pointer-events-none whitespace-nowrap"
                style={{
                  left: `${pctX(cx)}%`,
                  top: `${pctY(anchorY)}%`,
                  transform: `translate(${flipL ? "calc(-100% - 8px)" : "8px"}, -100%)`,
                }}
              >
                <p className="font-semibold text-navy">{d.label}</p>
                <p className="text-navy/60 mt-0.5">{d.sold}/{d.capacity} plazas</p>
                <p className="text-[#43884d] font-semibold mt-0.5">{Math.round(d.occ * 100)}% ocupación</p>
              </div>
            );
          })()}

          {/* Event tooltip — same HTML-overlay reasoning as the hover tooltip above */}
          {data.map((d, i) => {
            const evs = eventsByPeriod.get(d.key) ?? [];
            return evs.map((ev, ei) => {
              if (hoveredEventId !== ev.id) return null;
              const cx = evs.length > 1 ? barCx(i) + (ei - (evs.length - 1) / 2) * 7 : barCx(i);
              const color = EVENT_COLORS[ev.categoria];
              const flipL = pctX(cx) > 70;
              return (
                <div
                  key={`evtip-${ev.id}`}
                  className="absolute z-20 bg-white border border-[#e6e6ea] rounded-[10px] shadow-lg px-3 py-2 text-xs leading-snug pointer-events-none max-w-[200px]"
                  style={{
                    left: `${pctX(cx)}%`,
                    top: `${pctY(MT)}%`,
                    transform: `translate(${flipL ? "calc(-100% - 8px)" : "8px"}, 0%)`,
                  }}
                >
                  <div className="flex items-center gap-2 justify-between">
                    <span className="flex items-center gap-1.5 font-semibold" style={{ color }}>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      {EVENT_LABELS[ev.categoria]}
                    </span>
                    <span className="text-navy/40 shrink-0">{fmtEventDate(ev.fecha)}</span>
                  </div>
                  <p className="font-semibold text-navy mt-1">{ev.titulo}</p>
                  {ev.descripcion && <p className="text-navy/55 mt-0.5">{ev.descripcion}</p>}
                </div>
              );
            });
          })}

          {/* Week labels — plain HTML, fixed CSS font size */}
          {data.map((d, i) => {
            if (data.length > 14 && i % 2 === 1) return null; // thin out labels on long ranges
            return (
              <div
                key={`wk-${d.key}`}
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
              { key: "free", label: "Plazas libres", color: "#C0C6E8", value: totalFree, helper: pct(totalCapacity > 0 ? totalFree / totalCapacity : 0) },
            ]}
          />
        </div>
      </div>
    </ChartCard>
  );
}
