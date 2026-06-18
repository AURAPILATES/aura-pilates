"use client";

import { memo } from "react";
import { MomenceEvent } from "@/lib/momence";
import { pct, occupancyRate } from "@/lib/analytics";

type DayGroup = { dateKey: string; label: string; events: MomenceEvent[] };

function occText(occ: number) {
  if (occ >= 0.8) return "text-[#4e8a5d]";
  if (occ >= 0.5) return "text-[#a38540]";
  return "text-[#c03828]";
}

function occBorder(occ: number) {
  if (occ >= 0.8) return "border-l-[#4e8a5d]";
  if (occ >= 0.5) return "border-l-[#a38540]";
  return "border-l-[#c03828]";
}

function occBarColor(occ: number) {
  if (occ >= 0.8) return "bg-[#4e8a5d]";
  if (occ >= 0.5) return "bg-[#a38540]";
  return "bg-[#c03828]";
}

function occBadge(occ: number) {
  if (occ >= 1.0) return { bg: "bg-[#eaf4ee]", text: "text-[#4e8a5d]", label: "Llena" };
  if (occ >= 0.8) return { bg: "bg-[#fdf0e5]", text: "text-[#c07030]", label: "Casi llena" };
  if (occ >= 0.5) return { bg: "bg-[#f5f0e0]", text: "text-[#a38540]", label: "A medias" };
  return { bg: "bg-[#fdecea]", text: "text-[#c03828]", label: "Por llenar" };
}

export default memo(function HorarioList({
  days,
  onSelect,
}: {
  days: DayGroup[];
  onSelect: (e: MomenceEvent) => void;
}) {
  if (days.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-navy/40">No hay clases con estos filtros.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {days.map(({ dateKey, events: dayEvents }) => {
        const dayOcc      = occupancyRate(dayEvents);
        const dayStudents = dayEvents.reduce((s, e) => s + e.ticketsSold, 0);
        const dayFree     = dayEvents.reduce((s, e) => s + e.spotsRemaining, 0);
        const dayTotal    = dayEvents.reduce((s, e) => s + e.capacity, 0);

        const d       = new Date(dateKey + "T12:00:00");
        const dayName = d.toLocaleDateString("es-ES", { weekday: "long", timeZone: "Europe/Madrid" });
        const dayNum  = d.getDate();

        return (
          <div key={dateKey}>
            {/* Day header */}
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-navy/[0.09]">
              <h2 className="text-2xl font-bold text-navy capitalize leading-none">
                {dayName} <span className="font-light text-xl">{dayNum}</span>
              </h2>
              <div className="flex items-center gap-5 text-sm shrink-0">
                <span className="text-navy/45">
                  <span className="font-semibold text-navy">{dayEvents.length}</span> clases
                </span>
                <span className="text-navy/45 tabular-nums">
                  <span className="font-semibold text-navy">{dayStudents}/{dayTotal}</span> alumnos
                </span>
                <span className="text-navy/45 tabular-nums">
                  <span className={`font-semibold ${dayFree === 0 ? "text-navy/30" : "text-navy"}`}>{dayFree}</span> libres
                </span>
                <span className={`font-bold tabular-nums ${occText(dayOcc)}`}>{pct(dayOcc)}</span>
              </div>
            </div>

            {/* Events */}
            <div className="mt-3 space-y-2">
              {dayEvents.map((e) => {
                const occ    = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
                const pctVal = Math.round(occ * 100);
                const time   = new Date(e.dateTime).toLocaleTimeString("es-ES", {
                  timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit",
                });
                const badge = occBadge(occ);

                return (
                  <div
                    key={e.id}
                    className={`bg-white border border-navy/[0.07] border-l-4 ${occBorder(occ)} rounded-2xl shadow-card overflow-hidden`}
                  >
                    <button
                      onClick={() => onSelect(e)}
                      className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-navy/[0.02] transition-colors"
                    >
                      <span className="font-mono text-sm text-navy/45 w-11 shrink-0">{time}</span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy truncate">{e.title}</p>
                        {e.teacher && <p className="text-xs text-navy/45 truncate">{e.teacher}</p>}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-28 shrink-0">
                          <div className="h-1 bg-navy/[0.08] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${occBarColor(occ)}`}
                              style={{ width: `${pctVal}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-navy/50 tabular-nums w-8 text-right shrink-0">{e.ticketsSold}/{e.capacity}</span>
                        <span className="text-xs text-navy/40 tabular-nums w-14 text-right shrink-0">
                          {e.spotsRemaining} libres
                        </span>
                        <span className={`text-sm font-bold tabular-nums w-10 text-right shrink-0 ${occText(occ)}`}>
                          {pctVal}%
                        </span>
                        <span className={`text-xs py-1 rounded-full font-medium shrink-0 w-[88px] inline-flex items-center justify-center ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                        <svg
                          width="14" height="14" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2"
                          className="text-navy/25 shrink-0"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </button>

                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
