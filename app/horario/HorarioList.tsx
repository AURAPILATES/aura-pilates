"use client";

import { memo } from "react";
import { MomenceEvent } from "@/lib/momence";
import { pct, occupancyRate } from "@/lib/analytics";

type DayGroup = { dateKey: string; label: string; events: MomenceEvent[] };

function occText(occ: number) {
  if (occ >= 1.0) return "text-[#4e8a5d] dark:text-[#8dce9d]";
  if (occ >= 0.5) return "text-[#a38540] dark:text-[#ceba8d]";
  return "text-[#c03828] dark:text-[#d88c83]";
}

function occBarColor(occ: number) {
  if (occ >= 1.0) return "bg-[#4e8a5d] dark:bg-[#8dce9d]";
  if (occ >= 0.5) return "bg-[#a38540] dark:bg-[#ceba8d]";
  return "bg-[#c03828] dark:bg-[#d88c83]";
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
    <div className="space-y-6">
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
            <div className="flex items-center justify-between gap-4 pb-2.5 border-b border-navy/[0.09]">
              <h2 className="text-lg font-semibold text-navy capitalize leading-none">
                {dayName} <span className="font-normal text-base">{dayNum}</span>
              </h2>
              <div className="flex items-center gap-4 text-xs shrink-0">
                <span className="text-navy/45">
                  <span className="font-semibold text-navy">{dayEvents.length}</span> clases
                </span>
                <span className="text-navy/45 tabular-nums">
                  <span className="font-semibold text-navy">{dayStudents}/{dayTotal}</span> alumnos
                </span>
                <span className="text-navy/45 tabular-nums">
                  <span className={`font-semibold ${dayFree === 0 ? "text-navy/30" : "text-navy"}`}>{dayFree}</span> libres
                </span>
                <span className={`font-semibold tabular-nums ${occText(dayOcc)}`}>{pct(dayOcc)}</span>
              </div>
            </div>

            {/* Events */}
            <div className="mt-2.5 border border-navy/[0.07] rounded-xl divide-y divide-navy/[0.06] overflow-hidden">
              {dayEvents.map((e) => {
                const occ    = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
                const pctVal = Math.round(occ * 100);
                const time   = new Date(e.dateTime).toLocaleTimeString("es-ES", {
                  timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit",
                });

                return (
                  <button
                    key={e.id}
                    onClick={() => onSelect(e)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left bg-card hover:bg-navy/[0.02] transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${occBarColor(occ)}`} />
                    <span className="font-mono text-xs text-navy/45 w-10 shrink-0">{time}</span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy truncate">{e.title}</p>
                      {e.teacher && <p className="text-xs text-navy/45 truncate">{e.teacher}</p>}
                    </div>

                    {(e.waitlistCount ?? 0) > 0 && (
                      <span
                        className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f5f0e0] dark:bg-[#393013] text-[#a38540] dark:text-[#ceba8d]"
                        title="Personas en lista de espera (Momence, en vivo): demanda que no cabe en la clase"
                      >
                        {e.waitlistCount} en espera
                      </span>
                    )}

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="w-24 shrink-0">
                        <div className="h-1 bg-navy/[0.08] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${occBarColor(occ)}`}
                            style={{ width: `${pctVal}%` }}
                          />
                        </div>
                      </div>
                      <span className={`text-xs font-bold tabular-nums w-9 text-right shrink-0 ${occText(occ)}`}>
                        {pctVal}%
                      </span>
                      <svg
                        width="13" height="13" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2"
                        className="text-navy/25 shrink-0"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
});
