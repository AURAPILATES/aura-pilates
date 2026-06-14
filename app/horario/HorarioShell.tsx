"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MomenceEvent } from "@/lib/momence";
import { groupByDay, occupancyRate, totalRevenue, fmt, pct } from "@/lib/analytics";
import HorarioList from "./HorarioList";
import HorarioCalendar from "./HorarioCalendar";
import HorarioDrawer from "./HorarioDrawer";

type OccFilter = "all" | "low" | "mid" | "high";
type View = "lista" | "calendario";

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function weekLabel(mondayStr: string): string {
  const monday = new Date(mondayStr + "T00:00:00");
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  const dStart = monday.getDate();
  const dEnd = sunday.getDate();
  const mStart = monday.toLocaleDateString("es-ES", { month: "short" });
  const mEnd = sunday.toLocaleDateString("es-ES", { month: "short" });
  return mStart === mEnd
    ? `${dStart}–${dEnd} ${mStart}`
    : `${dStart} ${mStart} – ${dEnd} ${mEnd}`;
}

export default function HorarioShell({
  events,
  weekMonday,
  initialView,
}: {
  events: MomenceEvent[];
  weekMonday: string;
  initialView: View;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [selected, setSelected] = useState<MomenceEvent | null>(null);
  const [claseFilter, setClaseFilter] = useState("all");
  const [instructoraFilter, setInstructoraFilter] = useState("all");
  const [occFilter, setOccFilter] = useState<OccFilter>("all");

  const clases = useMemo(
    () => ["all", ...Array.from(new Set(events.map((e) => e.title))).sort()],
    [events]
  );
  const instructoras = useMemo(
    () =>
      ["all", ...Array.from(new Set(events.map((e) => e.teacher).filter(Boolean))).sort()],
    [events]
  );

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (claseFilter !== "all" && e.title !== claseFilter) return false;
        if (instructoraFilter !== "all" && e.teacher !== instructoraFilter) return false;
        const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
        if (occFilter === "low" && occ >= 0.5) return false;
        if (occFilter === "mid" && (occ < 0.5 || occ >= 0.8)) return false;
        if (occFilter === "high" && occ < 0.8) return false;
        return true;
      }),
    [events, claseFilter, instructoraFilter, occFilter]
  );

  const days = useMemo(() => groupByDay(filtered), [filtered]);

  const weekOcc = occupancyRate(events);
  const weekRevenue = totalRevenue(events);
  const weekPotential = events.reduce((s, e) => s + e.capacity * e.fixedPrice, 0);
  const weekFreeSpots = events.reduce((s, e) => s + e.spotsRemaining, 0);
  const lowCount = events.filter(
    (e) => e.capacity > 0 && e.ticketsSold / e.capacity < 0.5
  ).length;

  const prevWeek = addDays(weekMonday, -7);
  const nextWeek = addDays(weekMonday, 7);
  const hasFilters = claseFilter !== "all" || instructoraFilter !== "all" || occFilter !== "all";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-navy font-display">Horario</h1>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Week navigation */}
          <div className="flex items-center gap-0.5 bg-white border border-navy/[0.08] rounded-xl overflow-hidden">
            <button
              onClick={() => router.push(`?week=${prevWeek}`)}
              className="w-8 h-8 flex items-center justify-center text-navy/50 hover:text-navy hover:bg-navy/5 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="text-sm font-medium text-navy px-2 min-w-[120px] text-center">
              {weekLabel(weekMonday)}
            </span>
            <button
              onClick={() => router.push(`?week=${nextWeek}`)}
              className="w-8 h-8 flex items-center justify-center text-navy/50 hover:text-navy hover:bg-navy/5 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* View toggle */}
          <div className="flex border border-navy/[0.08] rounded-xl overflow-hidden bg-white text-sm">
            {(["lista", "calendario"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 capitalize transition-colors ${
                  view === v ? "bg-navy text-white" : "text-navy/50 hover:text-navy"
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats bar */}
      {events.length > 0 && (
        <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card px-5 py-4 mb-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <StatItem
            label="Ocupación media"
            value={pct(weekOcc)}
            accent={weekOcc >= 0.8 ? "text-success" : weekOcc >= 0.5 ? "text-warning" : "text-danger"}
          />
          <div className="h-7 w-px bg-navy/[0.08]" />
          <StatItem label="Ingresos sem." value={fmt(weekRevenue)} />
          <div className="h-7 w-px bg-navy/[0.08]" />
          <StatItem label="Potencial" value={fmt(weekPotential)} accent="text-navy/40" />
          <div className="h-7 w-px bg-navy/[0.08]" />
          <StatItem label="Plazas libres" value={String(weekFreeSpots)} />
          {lowCount > 0 && (
            <>
              <div className="h-7 w-px bg-navy/[0.08]" />
              <span className="text-xs font-medium bg-warning/10 text-warning px-3 py-1.5 rounded-lg">
                {lowCount} clase{lowCount !== 1 ? "s" : ""} por llenar
              </span>
            </>
          )}
        </div>
      )}

      {/* Filters (list view only) */}
      {view === "lista" && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select
            value={claseFilter}
            onChange={setClaseFilter}
            options={clases}
            placeholder="Todas las clases"
          />
          <Select
            value={instructoraFilter}
            onChange={setInstructoraFilter}
            options={instructoras}
            placeholder="Todas las instructoras"
          />
          <div className="flex border border-navy/[0.08] rounded-xl overflow-hidden bg-white text-sm">
            {(
              [
                { value: "all", label: "Todas" },
                { value: "low", label: "Por llenar" },
                { value: "mid", label: "A medias" },
                { value: "high", label: "Llenas" },
              ] as { value: OccFilter; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setOccFilter(value)}
                className={`px-3 py-1.5 transition-colors ${
                  occFilter === value
                    ? "bg-navy text-white"
                    : "text-navy/50 hover:text-navy"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button
              onClick={() => {
                setClaseFilter("all");
                setInstructoraFilter("all");
                setOccFilter("all");
              }}
              className="text-xs text-navy/50 hover:text-navy underline"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* No events state */}
      {events.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-navy/35 text-sm">No hay clases esta semana.</p>
        </div>
      ) : view === "lista" ? (
        <HorarioList days={days} onSelect={setSelected} />
      ) : (
        <HorarioCalendar events={filtered} weekMonday={weekMonday} onSelect={setSelected} />
      )}

      {/* Drawer */}
      {selected && <HorarioDrawer event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StatItem({
  label,
  value,
  accent = "text-navy",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-navy/40 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm border border-navy/[0.08] rounded-xl bg-white text-navy px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/20"
    >
      <option value="all">{placeholder}</option>
      {options.slice(1).map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
