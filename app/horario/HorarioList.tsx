"use client";

import { MomenceEvent } from "@/lib/momence";
import { fmt, pct, occupancyRate, totalRevenue } from "@/lib/analytics";

type DayGroup = { dateKey: string; label: string; events: MomenceEvent[] };

function occDot(occ: number) {
  if (occ >= 0.8) return "bg-success";
  if (occ >= 0.6) return "bg-primary";
  if (occ >= 0.4) return "bg-warning";
  return "bg-danger";
}

function occText(occ: number) {
  if (occ >= 0.8) return "text-success";
  if (occ >= 0.6) return "text-primary";
  if (occ >= 0.4) return "text-warning";
  return "text-danger";
}

export default function HorarioList({
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
      {days.map(({ dateKey, label, events: dayEvents }) => {
        const dayOcc = occupancyRate(dayEvents);
        const dayRevenue = totalRevenue(dayEvents);
        const dayStudents = dayEvents.reduce((s, e) => s + e.ticketsSold, 0);

        return (
          <div key={dateKey}>
            {/* Day header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-navy/45 uppercase tracking-widest capitalize">
                {label}
              </h2>
              {/* Day stats chips */}
              <div className="flex bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
                <Chip label="clases" value={String(dayEvents.length)} />
                <Chip label="alumnos" value={String(dayStudents)} />
                <Chip label="ocupación" value={pct(dayOcc)} valueClass={occText(dayOcc)} />
                <Chip label="ingresos" value={fmt(dayRevenue)} last />
              </div>
            </div>

            {/* Events table */}
            <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
              {dayEvents.map((e, i) => {
                const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
                const pctVal = Math.round(occ * 100);
                const time = new Date(e.dateTime).toLocaleTimeString("es-ES", {
                  timeZone: "Europe/Madrid",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <button
                    key={e.id}
                    onClick={() => onSelect(e)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-navy/[0.025] transition-colors ${
                      i < dayEvents.length - 1 ? "border-b border-navy/5" : ""
                    }`}
                  >
                    {/* Occupancy dot */}
                    <span className={`w-2 h-2 rounded-full shrink-0 ${occDot(occ)}`} />

                    {/* Time */}
                    <span className="font-mono text-xs text-navy/45 w-11 shrink-0">{time}</span>

                    {/* Name + teacher */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{e.title}</p>
                      {e.teacher && (
                        <p className="text-xs text-navy/45 truncate">{e.teacher}</p>
                      )}
                    </div>

                    {/* Libres badge */}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        e.spotsRemaining === 0
                          ? "bg-success/10 text-success font-medium"
                          : e.spotsRemaining <= 3
                          ? "bg-warning/10 text-warning"
                          : "bg-navy/5 text-navy/45"
                      }`}
                    >
                      {e.spotsRemaining === 0 ? "Llena ✦" : `${e.spotsRemaining} libres`}
                    </span>

                    {/* Occ % */}
                    <span className={`text-sm font-semibold tabular-nums w-10 text-right shrink-0 ${occText(occ)}`}>
                      {pctVal}%
                    </span>

                    {/* Revenue */}
                    <span className="text-sm text-navy/60 font-medium w-16 text-right shrink-0">
                      {fmt(e.ticketsSold * e.fixedPrice)}
                    </span>

                    {/* Chevron */}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-navy/25 shrink-0"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Chip({
  label,
  value,
  valueClass = "text-navy",
  last = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  last?: boolean;
}) {
  return (
    <div className={`px-3 py-2 text-center ${last ? "" : "border-r border-navy/10"}`}>
      <p className="text-[10px] text-navy/45 uppercase tracking-wide">{label}</p>
      <p className={`text-xs font-semibold mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  );
}
