"use client";

import { MomenceEvent } from "@/lib/momence";
import { fmt } from "@/lib/analytics";

const START_HOUR = 7;
const END_HOUR = 22;
const SLOT_PX = 110; // px per hour
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

type OccStyle = {
  card: string;
  pct: string;
  bar: string;
};

function occStyle(occ: number): OccStyle {
  if (occ >= 0.8) return {
    card: "bg-[#e8efe5] border-[#c8dcc3]",
    pct: "text-[#3d7048]",
    bar: "bg-[#4e8a5d]",
  };
  if (occ >= 0.6) return {
    card: "bg-[#f2ede0] border-[#ddd0b0]",
    pct: "text-[#8b7230]",
    bar: "bg-[#a38540]",
  };
  if (occ >= 0.4) return {
    card: "bg-[#f5ece0] border-[#e0ceae]",
    pct: "text-[#b06020]",
    bar: "bg-[#c07030]",
  };
  return {
    card: "bg-[#f5e2de] border-[#e0c0b8]",
    pct: "text-[#b03020]",
    bar: "bg-[#c03828]",
  };
}

function dayStats(events: MomenceEvent[]) {
  if (events.length === 0) return null;
  const totalCap = events.reduce((s, e) => s + e.capacity, 0);
  const totalSold = events.reduce((s, e) => s + e.ticketsSold, 0);
  const occ = totalCap > 0 ? totalSold / totalCap : 0;
  const revenue = events.reduce((s, e) => s + e.ticketsSold * e.fixedPrice, 0);
  return { occ, revenue };
}

export default function HorarioCalendar({
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

  const byDay = Array.from({ length: 7 }, () => [] as MomenceEvent[]);
  for (const e of events) {
    const d = new Date(e.dateTime);
    const dow = (d.getDay() + 6) % 7;
    if (dow >= 0 && dow < 7) byDay[dow].push(e);
  }

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
      {/* Day headers */}
      <div
        className="grid border-b border-navy/[0.08]"
        style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}
      >
        <div className="border-r border-navy/[0.07]" />
        {DAY_LABELS.map((label, i) => {
          const day = new Date(monday.getTime() + i * 86400000);
          const isToday = day.toLocaleDateString("sv-SE") === todayKey;
          const stats = dayStats(byDay[i]);
          const pctColor = stats
            ? stats.occ >= 0.8
              ? "text-[#3d7048]"
              : stats.occ >= 0.6
              ? "text-[#8b7230]"
              : stats.occ >= 0.4
              ? "text-[#b06020]"
              : "text-[#b03020]"
            : "text-navy/30";

          return (
            <div
              key={i}
              className={`py-3 px-3 border-r border-navy/[0.07] last:border-r-0 ${
                isToday ? "bg-navy/[0.025]" : ""
              }`}
            >
              <p className={`text-sm font-semibold ${isToday ? "text-primary" : "text-navy"}`}>
                {label}{" "}
                <span className="font-normal text-navy/40 text-xs">{day.getDate()}</span>
              </p>
              {stats ? (
                <p className={`text-xs mt-0.5 font-medium ${pctColor}`}>
                  {Math.round(stats.occ * 100)}%
                  <span className="text-navy/35 font-normal"> · {fmt(stats.revenue)}</span>
                </p>
              ) : (
                <p className="text-xs mt-0.5 text-navy/25">—</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: "680px" }}>
        <div
          className="grid"
          style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}
        >
          {/* Hour labels */}
          <div>
            {HOURS.map((h) => (
              <div
                key={h}
                className="border-r border-b border-navy/[0.06] flex items-start justify-end pr-2 pt-1.5"
                style={{ height: `${SLOT_PX}px` }}
              >
                <span className="text-[10px] text-navy/30 font-mono">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {byDay.map((dayEvents, dayIndex) => {
            const day = new Date(monday.getTime() + dayIndex * 86400000);
            const isToday = day.toLocaleDateString("sv-SE") === todayKey;
            return (
              <div
                key={dayIndex}
                className={`relative border-r border-navy/[0.07] last:border-r-0 ${
                  isToday ? "bg-navy/[0.012]" : ""
                }`}
                style={{ height: `${HOURS.length * SLOT_PX}px` }}
              >
                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-b border-navy/[0.05]"
                    style={{ top: `${(h - START_HOUR) * SLOT_PX}px` }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((e) => {
                  const d = new Date(e.dateTime);
                  const h = d.getHours();
                  const m = d.getMinutes();
                  const topPx = (h - START_HOUR + m / 60) * SLOT_PX;
                  const heightPx = Math.max((e.duration / 60) * SLOT_PX - 4, 36);
                  const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
                  const pctVal = Math.round(occ * 100);
                  const style = occStyle(occ);
                  const timeStr = d.toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Madrid",
                  });

                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e)}
                      className={`absolute left-1 right-1 rounded-xl border text-left overflow-hidden hover:brightness-[0.97] active:scale-[0.99] transition-all flex flex-col justify-between ${style.card}`}
                      style={{ top: `${topPx + 2}px`, height: `${heightPx}px` }}
                    >
                      <div className="px-2.5 pt-2 flex-1 min-h-0 overflow-hidden">
                        {/* Time + occ% */}
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-semibold text-navy/55 font-mono">
                            {timeStr}
                          </span>
                          <span className={`text-[10px] font-bold ${style.pct}`}>
                            {pctVal}%
                          </span>
                        </div>
                        {/* Class name */}
                        <p className="text-xs font-bold text-navy leading-tight truncate">
                          {e.title}
                        </p>
                        {/* Teacher */}
                        {heightPx > 55 && e.teacher && (
                          <p className="text-[10px] text-navy/50 truncate mt-0.5">
                            {e.teacher}
                          </p>
                        )}
                        {/* Spots */}
                        {heightPx > 70 && (
                          <p className="text-[10px] text-navy/50 mt-0.5">
                            {e.ticketsSold}/{e.capacity}
                          </p>
                        )}
                      </div>
                      {/* Progress bar */}
                      {heightPx > 50 && (
                        <div className="px-2.5 pb-2 mt-1">
                          <div className="h-[3px] rounded-full bg-black/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${style.bar}`}
                              style={{ width: `${pctVal}%` }}
                            />
                          </div>
                        </div>
                      )}
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
}
