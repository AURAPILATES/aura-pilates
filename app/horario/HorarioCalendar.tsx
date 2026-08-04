"use client";

import { useMemo, memo } from "react";
import { MomenceEvent } from "@/lib/momence";

const SLOT_PX = 92;      // px per hour slot
const SEP_PX = 36;       // px for the gap-separator row
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type OccStyle = { card: string; pct: string; bar: string };
function occStyle(occ: number): OccStyle {
  if (occ >= 1.0) return { card: "bg-[#e8efe5] dark:bg-[#22301c] border-[#c8dcc3] dark:border-[#425f3a]", pct: "text-[#3d7048] dark:text-[#8dce9b]", bar: "bg-[#4e8a5d] dark:bg-[#8dce9d]" };
  if (occ >= 0.5) return { card: "bg-[#f2ede0] dark:bg-[#372e15] border-[#ddd0b0] dark:border-[#685831]", pct: "text-[#8b7230] dark:text-[#cebc8d]", bar: "bg-[#a38540] dark:bg-[#ceba8d]" };
  return { card: "bg-[#f5e2de] dark:bg-[#391a13] border-[#e0c0b8] dark:border-[#683c31]", pct: "text-[#b03020] dark:text-[#db8a80]", bar: "bg-[#c03828] dark:bg-[#d88c83]" };
}

function pctColor(occ: number) {
  if (occ >= 0.8) return "text-[#3d7048] dark:text-[#8dce9b]";
  if (occ >= 0.6) return "text-[#8b7230] dark:text-[#cebc8d]";
  if (occ >= 0.4) return "text-[#b06020] dark:text-[#dba880]";
  return "text-[#b03020] dark:text-[#db8a80]";
}

function dayStats(events: MomenceEvent[]) {
  if (!events.length) return null;
  const totalCap = events.reduce((s, e) => s + e.capacity, 0);
  const totalSold = events.reduce((s, e) => s + e.ticketsSold, 0);
  return { occ: totalCap > 0 ? totalSold / totalCap : 0, sold: totalSold, capacity: totalCap };
}

/** Groups consecutive integers into runs: [7,8,9,17,18] → [[7,8,9],[17,18]] */
function clusterHours(hours: number[]): number[][] {
  const clusters: number[][] = [];
  for (const h of hours) {
    const last = clusters[clusters.length - 1];
    if (last && h === last[last.length - 1] + 1) {
      last.push(h);
    } else {
      clusters.push([h]);
    }
  }
  return clusters;
}

/** Returns a map: hour → Y offset in the rendered grid */
function buildHourMap(clusters: number[][]): { hourMap: Map<number, number>; totalH: number } {
  const hourMap = new Map<number, number>();
  let y = 0;
  for (let ci = 0; ci < clusters.length; ci++) {
    if (ci > 0) y += SEP_PX; // separator between clusters
    for (const h of clusters[ci]) {
      hourMap.set(h, y);
      y += SLOT_PX;
    }
  }
  return { hourMap, totalH: y };
}

export default memo(function HorarioCalendar({
  events,
  weekMonday,
  onSelect,
}: {
  events: MomenceEvent[];
  weekMonday: string;
  onSelect: (e: MomenceEvent) => void;
}) {
  const monday = new Date(weekMonday + "T00:00:00");
  const todayKey = new Date().toLocaleDateString("sv-SE");

  const byDay = useMemo(() => {
    const arr = Array.from({ length: 7 }, () => [] as MomenceEvent[]);
    for (const e of events) {
      const dow = (new Date(e.dateTime).getDay() + 6) % 7;
      if (dow >= 0 && dow < 7) arr[dow].push(e);
    }
    return arr;
  }, [events]);

  // Compute active hours: every hour touched by at least one event
  const { clusters, hourMap, totalH } = useMemo(() => {
    const active = new Set<number>();
    for (const e of events) {
      const d = new Date(e.dateTime);
      const startH = d.getHours();
      const spanH = Math.ceil((d.getMinutes() + e.duration) / 60);
      for (let i = 0; i < spanH; i++) active.add(startH + i);
    }
    const sorted = Array.from(active).sort((a, b) => a - b);
    const cls = clusterHours(sorted);
    const { hourMap, totalH } = buildHourMap(cls);
    return { clusters: cls, hourMap, totalH };
  }, [events]);

  function eventTopPx(e: MomenceEvent): number {
    const d = new Date(e.dateTime);
    const h = d.getHours();
    const base = hourMap.get(h) ?? 0;
    return base + (d.getMinutes() / 60) * SLOT_PX;
  }

  if (events.length === 0) {
    return (
      <div className="bg-card border border-border rounded-[10px] p-16 text-center text-navy/35 text-sm">
        No hay clases esta semana.
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      {/* Day headers */}
      <div className="grid border-b border-navy/[0.08] bg-navy/[0.03]" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
        <div className="border-r border-navy/[0.07]" />
        {DAY_LABELS.map((label, i) => {
          const day = new Date(monday.getTime() + i * 86400000);
          const isToday = day.toLocaleDateString("sv-SE") === todayKey;
          const stats = dayStats(byDay[i]);
          return (
            <div
              key={i}
              className={`py-3 px-3 border-r border-navy/[0.07] last:border-r-0 ${isToday ? "bg-primary/[0.06]" : ""}`}
            >
              <p className={`text-sm font-semibold ${isToday ? "text-primary" : "text-navy"}`}>
                {label} {day.getDate()}
              </p>
              {stats ? (
                <p className="text-xs mt-0.5">
                  <span className="text-navy/45">{stats.sold}/{stats.capacity} plazas</span>
                  <span className="text-navy/30"> · </span>
                  <span className={`font-medium ${pctColor(stats.occ)}`}>{Math.round(stats.occ * 100)}%</span>
                </p>
              ) : (
                <p className="text-xs mt-0.5 text-navy/25">SIN CLASES</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div>
        <div className="grid" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>

          {/* Hour labels + separators column */}
          <div className="relative border-r border-navy/[0.07]" style={{ height: `${totalH}px` }}>
            {clusters.map((cluster, ci) => {
              const clusterStartY = hourMap.get(cluster[0]) ?? 0;
              const gapStart = ci > 0 ? clusters[ci - 1][clusters[ci - 1].length - 1] + 1 : null;
              const gapEnd = ci > 0 ? cluster[0] : null;

              return (
                <div key={ci}>
                  {/* Separator above this cluster (except first) */}
                  {ci > 0 && (
                    <div
                      className="absolute left-0 right-0 flex items-center justify-end pr-2"
                      style={{ top: `${clusterStartY - SEP_PX}px`, height: `${SEP_PX}px` }}
                    >
                      <span className="text-[8px] text-navy/25 font-mono leading-tight text-right">
                        sin clases<br/>{gapStart}h–{gapEnd}h
                      </span>
                    </div>
                  )}
                  {/* Hour slots */}
                  {cluster.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-b border-navy/[0.06] flex items-start justify-end pr-2 pt-1.5"
                      style={{ top: `${hourMap.get(h)}px`, height: `${SLOT_PX}px` }}
                    >
                      <span className="text-[12px] text-navy/30 font-mono">
                        {String(h).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {byDay.map((dayEvents, dayIndex) => {
            const day = new Date(monday.getTime() + dayIndex * 86400000);
            const isToday = day.toLocaleDateString("sv-SE") === todayKey;

            return (
              <div
                key={dayIndex}
                className={`relative border-r border-navy/[0.07] last:border-r-0 ${isToday ? "bg-navy/[0.012]" : ""}`}
                style={{ height: `${totalH}px` }}
              >
                {/* Grid lines per cluster */}
                {clusters.map((cluster, ci) => {
                  const clusterStartY = hourMap.get(cluster[0]) ?? 0;
                  return (
                    <div key={ci}>
                      {/* Separator row */}
                      {ci > 0 && (
                        <div
                          className="absolute left-0 right-0 bg-navy/[0.025] border-y border-navy/[0.05] [background-image:repeating-linear-gradient(135deg,transparent,transparent_5px,rgba(0,0,0,0.025)_5px,rgba(0,0,0,0.025)_6px)]"
                          style={{ top: `${clusterStartY - SEP_PX}px`, height: `${SEP_PX}px` }}
                        />
                      )}
                      {/* Hour borders */}
                      {cluster.map((h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-b border-navy/[0.05]"
                          style={{ top: `${hourMap.get(h)}px`, height: `${SLOT_PX}px` }}
                        />
                      ))}
                    </div>
                  );
                })}

                {/* Events */}
                {dayEvents.map((e) => {
                  const topPx = eventTopPx(e);
                  const heightPx = Math.max((e.duration / 60) * SLOT_PX - 4, 36);
                  const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
                  const pctVal = Math.round(occ * 100);
                  const style = occStyle(occ);

                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e)}
                      className={`absolute left-1 right-1 rounded-xl border text-left overflow-hidden hover:brightness-[0.97] active:scale-[0.99] transition-all ${style.card}`}
                      style={{ top: `${topPx + 2}px`, height: `${heightPx}px` }}
                    >
                      <div className="px-2.5 pt-2 pb-2 overflow-hidden">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-semibold text-navy/55 font-mono">
                            {e.ticketsSold}/{e.capacity}
                            {(e.waitlistCount ?? 0) > 0 && (
                              <span title={`${e.waitlistCount} en lista de espera`}> +{e.waitlistCount}⏳</span>
                            )}
                          </span>
                          <span className={`text-[10px] font-bold ${style.pct}`}>{pctVal}%</span>
                        </div>
                        <p className="text-xs font-bold text-navy leading-tight truncate">{e.title}</p>
                        {heightPx > 55 && e.teacher && (
                          <p className="text-[10px] text-navy/50 truncate mt-0.5">{e.teacher}</p>
                        )}
                        {heightPx > 50 && (
                          <div className="h-[3px] rounded-full bg-black/10 overflow-hidden mt-1.5">
                            <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pctVal}%` }} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
