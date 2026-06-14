"use client";

import { memo } from "react";
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
      {days.map(({ dateKey, label, events: dayEvents }) => {
        const dayOcc = occupancyRate(dayEvents);
        const dayRevenue = totalRevenue(dayEvents);
        const dayStudents = dayEvents.reduce((s, e) => s + e.ticketsSold, 0);
        const dayUnsold = dayEvents.reduce((s, e) => s + e.spotsRemaining * e.fixedPrice, 0);

        const d = new Date(dateKey + "T12:00:00");
        const dayName = d.toLocaleDateString("es-ES", { weekday: "long", timeZone: "Europe/Madrid" });
        const dayNum  = d.getDate();

        return (
          <div key={dateKey}>
            {/* Day header */}
            <div className="flex items-baseline justify-between gap-4 pb-3 mb-0 border-b border-navy/[0.09]">
              <h2 className="text-2xl font-bold text-navy font-display capitalize leading-none">
                {dayName} <span className="text-navy font-light text-xl">{dayNum}</span>
              </h2>
              <div className="flex items-start gap-8 shrink-0">
                <DayStat label="CLASES"     value={String(dayEvents.length)} />
                <DayStat label="ALUMNOS"    value={String(dayStudents)} />
                <DayStat label="OCUPACIÓN"  value={pct(dayOcc)} valueClass={occText(dayOcc)} />
                <DayStat label="INGRESOS"   value={fmt(dayRevenue)} />
                <DayStat label="SIN VENDER" value={dayUnsold > 0 ? `-${fmt(dayUnsold)}` : "—"} valueClass={dayUnsold > 0 ? "text-danger/70" : "text-navy/25"} />
              </div>
            </div>

            {/* Events table */}
            <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden mt-3">
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

                    {/* Sin vender */}
                    <span className={`text-sm font-medium w-16 text-right shrink-0 ${e.spotsRemaining > 0 ? "text-danger/70" : "text-navy/20"}`}>
                      {e.spotsRemaining > 0 ? `-${fmt(e.spotsRemaining * e.fixedPrice)}` : "—"}
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
});

function DayStat({
  label,
  value,
  valueClass = "text-navy",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="text-right">
      <p className="text-[10px] text-navy/40 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-sm font-bold mt-0.5 tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
