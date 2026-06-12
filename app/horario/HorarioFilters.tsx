"use client";

import { useState, useMemo } from "react";
import { MomenceEvent } from "@/lib/momence";
import { fmt, groupByDay, occupancyRate, pct, totalRevenue } from "@/lib/analytics";

type OccFilter = "all" | "low" | "mid" | "high" | "full";

export default function HorarioFilters({ events }: { events: MomenceEvent[] }) {
  const [claseFilter, setClaseFilter] = useState("all");
  const [instructoraFilter, setInstructoraFilter] = useState("all");
  const [occFilter, setOccFilter] = useState<OccFilter>("all");

  const clases = useMemo(
    () => ["all", ...Array.from(new Set(events.map((e) => e.title))).sort()],
    [events]
  );
  const instructoras = useMemo(
    () => ["all", ...Array.from(new Set(events.map((e) => e.teacher).filter(Boolean))).sort()],
    [events]
  );

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (claseFilter !== "all" && e.title !== claseFilter) return false;
      if (instructoraFilter !== "all" && e.teacher !== instructoraFilter) return false;
      const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
      if (occFilter === "low" && occ >= 0.5) return false;
      if (occFilter === "mid" && (occ < 0.5 || occ >= 0.8)) return false;
      if (occFilter === "high" && (occ < 0.8 || e.spotsRemaining === 0)) return false;
      if (occFilter === "full" && e.spotsRemaining !== 0) return false;
      return true;
    });
  }, [events, claseFilter, instructoraFilter, occFilter]);

  const days = groupByDay(filtered);
  const activeFilters = [claseFilter, instructoraFilter, occFilter].filter((f) => f !== "all").length;

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-8">
        <Select
          value={claseFilter}
          onChange={setClaseFilter}
          options={clases}
          label="Clase"
        />
        <Select
          value={instructoraFilter}
          onChange={setInstructoraFilter}
          options={instructoras}
          label="Instructora"
        />
        <div className="flex rounded overflow-hidden border border-navy/10 text-sm">
          {(
            [
              { value: "all", label: "Todas" },
              { value: "low", label: "< 50%" },
              { value: "mid", label: "50–80%" },
              { value: "high", label: "> 80%" },
              { value: "full", label: "Llena" },
            ] as { value: OccFilter; label: string }[]
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setOccFilter(value)}
              className={`px-3 py-1.5 transition-colors ${
                occFilter === value
                  ? "bg-navy text-white"
                  : "bg-white text-navy/50 hover:text-navy"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {activeFilters > 0 && (
          <button
            onClick={() => {
              setClaseFilter("all");
              setInstructoraFilter("all");
              setOccFilter("all");
            }}
            className="text-xs text-navy/40 hover:text-navy underline self-center"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Resultados */}
      {days.length === 0 ? (
        <p className="text-sm text-navy/40">No hay clases con estos filtros.</p>
      ) : (
        <div className="space-y-10">
          {days.map(({ dateKey, label, events: dayEvents }) => {
            const dayOcc = occupancyRate(dayEvents);
            const dayRevenue = totalRevenue(dayEvents);
            const dayStudents = dayEvents.reduce((s, e) => s + e.ticketsSold, 0);
            const occColor = dayOcc >= 0.7 ? "text-success" : dayOcc >= 0.5 ? "text-warning" : "text-danger";
            return (
            <div key={dateKey}>
              {/* Cabecera del día */}
              <div className="flex items-end justify-between mb-3">
                <h2 className="text-xs font-semibold text-navy/40 uppercase tracking-widest capitalize">
                  {label}
                </h2>
                <div className="flex items-baseline gap-6">
                  <div className="text-right">
                    <span className="text-xs text-navy/40 block">clases · alumnos</span>
                    <span className="text-sm font-semibold text-navy">{dayEvents.length} · {dayStudents}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-navy/40 block">ocupación</span>
                    <span className={`text-sm font-semibold ${occColor}`}>{pct(dayOcc)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-navy/40 block">ingresos</span>
                    <span className="text-sm font-semibold text-navy">{fmt(dayRevenue)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-navy/10 rounded shadow-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy/5 text-xs text-navy/40">
                      <th className="text-left px-5 py-3 font-medium">Hora</th>
                      <th className="text-left px-4 py-3 font-medium">Clase</th>
                      <th className="text-left px-4 py-3 font-medium">Instructora</th>
                      <th className="text-center px-4 py-3 font-medium">Ocupación</th>
                      <th className="text-center px-4 py-3 font-medium">Plazas</th>
                      <th className="text-right px-5 py-3 font-medium">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayEvents.map((e, i) => {
                      const time = new Date(e.dateTime).toLocaleTimeString("es-ES", {
                        timeZone: "Europe/Madrid",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
                      const isFull = e.spotsRemaining === 0;
                      return (
                        <tr
                          key={e.id}
                          className={i < dayEvents.length - 1 ? "border-b border-navy/5" : ""}
                        >
                          <td className="px-5 py-3.5 font-mono text-navy/50">{time}</td>
                          <td className="px-4 py-3.5 font-medium text-navy">{e.title}</td>
                          <td className="px-4 py-3.5 text-navy/50">{e.teacher}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-20 h-1.5 bg-navy/5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    occ >= 0.8 ? "bg-success" : occ >= 0.5 ? "bg-warning" : "bg-navy/20"
                                  }`}
                                  style={{ width: `${Math.round(occ * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-navy/40 w-8">{pct(occ)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                isFull
                                  ? "bg-income/10 text-income"
                                  : "bg-navy/5 text-navy/50"
                              }`}
                            >
                              {isFull ? "Llena" : `${e.spotsRemaining}/${e.capacity}`}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-medium text-navy">
                            {fmt(e.ticketsSold * e.fixedPrice)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm border border-navy/10 rounded bg-white text-navy px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30"
    >
      <option value="all">Todas las {label === "Clase" ? "clases" : "instructoras"}</option>
      {options.slice(1).map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
