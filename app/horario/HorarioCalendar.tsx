"use client";

import { MomenceEvent } from "@/lib/momence";

const START_HOUR = 7;
const END_HOUR = 22;
const SLOT_PX = 60; // px per hour
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function occStyle(occ: number) {
  if (occ >= 0.8) return "bg-success/15 border-success/30 text-success";
  if (occ >= 0.6) return "bg-primary/10 border-primary/20 text-primary";
  if (occ >= 0.4) return "bg-warning/10 border-warning/25 text-warning";
  return "bg-danger/10 border-danger/25 text-danger";
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
      {/* Day header */}
      <div
        className="grid border-b border-navy/10"
        style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}
      >
        <div className="border-r border-navy/[0.07]" />
        {DAY_LABELS.map((label, i) => {
          const day = new Date(monday.getTime() + i * 86400000);
          const isToday = day.toLocaleDateString("sv-SE") === todayKey;
          return (
            <div
              key={i}
              className={`py-3 text-center border-r border-navy/[0.07] last:border-r-0 ${
                isToday ? "bg-primary/5" : ""
              }`}
            >
              <p className={`text-[10px] font-medium uppercase tracking-wide ${isToday ? "text-primary" : "text-navy/40"}`}>
                {label}
              </p>
              <p className={`text-base font-bold mt-0.5 ${isToday ? "text-primary" : "text-navy"}`}>
                {day.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="overflow-y-auto" style={{ maxHeight: "620px" }}>
        <div
          className="grid relative"
          style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}
        >
          {/* Hour labels */}
          <div>
            {HOURS.map((h) => (
              <div
                key={h}
                className="border-r border-b border-navy/[0.07] flex items-start justify-end pr-2 pt-1"
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
                  isToday ? "bg-primary/[0.015]" : ""
                }`}
                style={{ height: `${HOURS.length * SLOT_PX}px` }}
              >
                {/* Grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-b border-navy/[0.05]"
                    style={{ top: `${(h - START_HOUR) * SLOT_PX}px`, height: `${SLOT_PX}px` }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((e) => {
                  const d = new Date(e.dateTime);
                  const h = d.getHours();
                  const m = d.getMinutes();
                  const topPx = (h - START_HOUR + m / 60) * SLOT_PX;
                  const heightPx = Math.max((e.duration / 60) * SLOT_PX, 28);
                  const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;

                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e)}
                      className={`absolute left-0.5 right-0.5 rounded-lg border text-left overflow-hidden hover:brightness-[0.96] active:scale-[0.98] transition-all ${occStyle(occ)}`}
                      style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                    >
                      <div className="px-1.5 py-1">
                        <p className="text-[10px] font-bold leading-tight truncate">
                          {e.title}
                        </p>
                        {heightPx > 36 && (
                          <p className="text-[9px] opacity-70 mt-0.5 truncate">
                            {d.toLocaleTimeString("es-ES", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Europe/Madrid",
                            })}
                            {" · "}{Math.round(occ * 100)}%
                          </p>
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
}
