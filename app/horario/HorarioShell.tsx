"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MomenceEvent } from "@/lib/momence";
import { groupByDay, occupancyRate, pct } from "@/lib/analytics";
import HorarioList from "./HorarioList";
import HorarioCalendar from "./HorarioCalendar";
import HorarioDrawer from "./HorarioDrawer";
import HorarioReporting, { type ReportingData } from "./HorarioReporting";

type OccFilter = "all" | "low" | "mid" | "high";
type View = "lista" | "calendario";
type Tab = "horario" | "analisis";

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function weekLabel(mondayStr: string): string {
  const monday = new Date(mondayStr + "T00:00:00");
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  const dStart = monday.getDate();
  const dEnd   = sunday.getDate();
  const mStart = monday.toLocaleDateString("es-ES", { month: "short" });
  const mEnd   = sunday.toLocaleDateString("es-ES", { month: "short" });
  return mStart === mEnd
    ? `${dStart}–${dEnd} ${mStart}`
    : `${dStart} ${mStart} – ${dEnd} ${mEnd}`;
}

function occText(occ: number) {
  if (occ >= 0.8) return "text-success";
  if (occ >= 0.6) return "text-primary";
  if (occ >= 0.4) return "text-warning";
  return "text-danger";
}

function getOccStatus(occ: number) {
  if (occ >= 1.0) return { label: "✓ Llena",    bg: "bg-[#eaf4ee]", text: "text-[#4e8a5d]", border: "border-l-[#4e8a5d]", dot: "bg-[#4e8a5d]" };
  if (occ >= 0.8) return { label: "Casi llena", bg: "bg-[#fdf0e5]", text: "text-[#c07030]", border: "border-l-[#c07030]", dot: "bg-[#c07030]" };
  if (occ >= 0.5) return { label: "A medias",   bg: "bg-[#f5f0e0]", text: "text-[#a38540]", border: "border-l-[#a38540]", dot: "bg-[#a38540]" };
  return             { label: "Por llenar",  bg: "bg-[#fdecea]", text: "text-[#c03828]", border: "border-l-[#c03828]", dot: "bg-[#c03828]" };
}

const MIN_WEEK    = "2026-06-15";
const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

export default function HorarioShell({
  events,
  weekMonday,
  initialView,
  initialTab,
  reportingData,
}: {
  events: MomenceEvent[];
  weekMonday: string;
  initialView: View;
  initialTab: Tab;
  reportingData: ReportingData;
}) {
  const router = useRouter();
  const [tab,      setTab]      = useState<Tab>(initialTab);
  const [view,     setView]     = useState<View>(initialView);
  const [selected, setSelected] = useState<MomenceEvent | null>(null);
  const [claseFilter,      setClaseFilter]      = useState("all");
  const [instructoraFilter, setInstructoraFilter] = useState("all");
  const [occFilter,        setOccFilter]        = useState<OccFilter>("all");
  const [mounted, setMounted] = useState<Record<View, boolean>>({ [initialView]: true } as Record<View, boolean>);
  useEffect(() => { setMounted((m) => ({ ...m, [view]: true })); }, [view]);
  const handleSelect = useCallback((e: MomenceEvent) => setSelected(e), []);

  // ── Week days for mobile pill selector ──────────────────────────────────────
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const key = addDays(weekMonday, i);
      const d   = new Date(key + "T12:00:00");
      return { key, letter: DAY_LETTERS[i], num: d.getDate(), hasEvents: events.some((e) => e.dateTime.startsWith(key)) };
    }),
    [weekMonday, events],
  );

  const defaultDay = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    if (today >= weekMonday && today <= addDays(weekMonday, 6)) return today;
    return weekDays.find((d) => d.hasEvents)?.key ?? weekMonday;
  }, [weekMonday, weekDays]);

  const [selectedDay, setSelectedDay] = useState(defaultDay);
  useEffect(() => setSelectedDay(defaultDay), [defaultDay]);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const clases = useMemo(
    () => ["all", ...Array.from(new Set(events.map((e) => e.title))).sort()],
    [events],
  );
  const instructoras = useMemo(
    () => ["all", ...Array.from(new Set(events.map((e) => e.teacher).filter(Boolean))).sort()],
    [events],
  );

  const filtered = useMemo(
    () => events.filter((e) => {
      if (claseFilter !== "all" && e.title !== claseFilter) return false;
      if (instructoraFilter !== "all" && e.teacher !== instructoraFilter) return false;
      const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
      if (occFilter === "low"  && occ >= 0.5) return false;
      if (occFilter === "mid"  && (occ < 0.5 || occ >= 0.8)) return false;
      if (occFilter === "high" && occ < 0.8) return false;
      return true;
    }),
    [events, claseFilter, instructoraFilter, occFilter],
  );

  const days = useMemo(() => groupByDay(filtered), [filtered]);

  // ── Week stats ───────────────────────────────────────────────────────────────
  const weekOcc        = occupancyRate(events);
  const weekFreeSpots  = events.reduce((s, e) => s + e.spotsRemaining, 0);
  const weekTotalSpots = events.reduce((s, e) => s + e.capacity, 0);
  const weekSoldSpots  = events.reduce((s, e) => s + e.ticketsSold, 0);
  const lowCount       = events.filter((e) => e.capacity > 0 && e.ticketsSold / e.capacity < 0.5).length;

  // ── Mobile: selected day data ────────────────────────────────────────────────
  const selectedDayEvents = useMemo(
    () => filtered.filter((e) => e.dateTime.startsWith(selectedDay)),
    [filtered, selectedDay],
  );
  const selectedDayName = new Date(selectedDay + "T12:00:00").toLocaleDateString("es-ES", {
    weekday: "long", timeZone: "Europe/Madrid",
  });
  const selectedDayOcc   = occupancyRate(selectedDayEvents);
  const selectedDaySold  = selectedDayEvents.reduce((s, e) => s + e.ticketsSold, 0);
  const selectedDayTotal = selectedDayEvents.reduce((s, e) => s + e.capacity, 0);

  const prevWeek  = addDays(weekMonday, -7);
  const nextWeek  = addDays(weekMonday, 7);
  const hasFilters = claseFilter !== "all" || instructoraFilter !== "all" || occFilter !== "all";

  // ── SVG helpers ──────────────────────────────────────────────────────────────
  const chevLeft  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>;
  const chevRight = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>;

  return (
    <div>
      {/* ══════════════════════════════════════════════════════════════════════
          STICKY HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center justify-between gap-3">
          {/* Left: title + tabs */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-navy uppercase tracking-widest">Horario</span>
            <div className="flex items-center border border-navy/[0.12] rounded-lg bg-white p-0.5 gap-0.5">
              {([{ v: "horario", l: "Horario" }, { v: "analisis", l: "Análisis" }] as { v: Tab; l: string }[]).map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => setTab(v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    tab === v ? "bg-navy text-white" : "text-navy/50 hover:text-navy"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Right: view toggle — desktop, horario tab only */}
          {tab === "horario" && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex border border-navy/[0.08] rounded-lg overflow-hidden bg-white text-xs">
                {([{ v: "lista", l: "Lista" }, { v: "calendario", l: "Calendario" }] as { v: View; l: string }[]).map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 transition-colors ${view === v ? "bg-navy text-white font-medium" : "text-navy/50 hover:text-navy"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CONTENT
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16">

        {/* ── MOBILE ─────────────────────────────────────────────────────────── */}
        <div className="sm:hidden">
          {tab === "analisis" ? (
            <HorarioReporting data={reportingData} />
          ) : (
            <>
              {/* Week nav */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-navy/50">Semana {weekLabel(weekMonday)}</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => router.push(`?week=${prevWeek}`)}
                    disabled={weekMonday <= MIN_WEEK}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-navy/[0.12] bg-white text-navy/50 disabled:opacity-20"
                  >
                    {chevLeft}
                  </button>
                  <button
                    onClick={() => router.push(`?week=${nextWeek}`)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-navy/[0.12] bg-white text-navy/50"
                  >
                    {chevRight}
                  </button>
                </div>
              </div>

              {/* Stats card */}
              {events.length > 0 && (
                <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card mb-5 overflow-hidden">
                  <div className="px-5 pt-5 pb-4 flex items-end gap-3">
                    <div className="flex items-end gap-1">
                      <span className="text-5xl font-bold text-navy leading-none">{Math.round(weekOcc * 100)}</span>
                      <span className="text-2xl font-bold text-navy mb-0.5">%</span>
                    </div>
                    <div className="mb-1">
                      <p className="text-xs text-navy/45 leading-tight">ocupación</p>
                      <p className="text-xs text-navy/45 leading-tight">media semana</p>
                    </div>
                  </div>
                  <div className="border-t border-navy/[0.06] grid grid-cols-3 divide-x divide-navy/[0.06]">
                    <div className="px-4 py-3">
                      <p className="text-[9px] text-navy/40 uppercase tracking-widest font-semibold">Vendidas</p>
                      <p className="text-base font-bold text-navy mt-0.5 tabular-nums">{weekSoldSpots}/{weekTotalSpots}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[9px] text-navy/40 uppercase tracking-widest font-semibold">Libres</p>
                      <p className="text-base font-bold text-navy mt-0.5 tabular-nums">{weekFreeSpots}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[9px] text-navy/40 uppercase tracking-widest font-semibold">Por llenar</p>
                      <p className={`text-base font-bold mt-0.5 tabular-nums ${lowCount > 0 ? "text-danger" : "text-navy/30"}`}>
                        {lowCount}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Day pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-none">
                {weekDays.map((day) => (
                  <button
                    key={day.key}
                    onClick={() => setSelectedDay(day.key)}
                    className={`shrink-0 flex flex-col items-center w-[52px] py-2.5 rounded-xl transition-colors ${
                      selectedDay === day.key
                        ? "bg-navy text-white"
                        : day.hasEvents
                        ? "bg-white border border-navy/[0.12] text-navy"
                        : "bg-white border border-navy/[0.07] text-navy/25"
                    }`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide">{day.letter}</span>
                    <span className="text-xl font-bold leading-none mt-1">{day.num}</span>
                  </button>
                ))}
              </div>

              {/* Selected day content */}
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-navy/40 text-center py-10">Sin clases este día.</p>
              ) : (
                <div>
                  <div className="flex items-baseline justify-between mb-3">
                    <h2 className="text-2xl font-bold text-navy font-display capitalize">{selectedDayName}</h2>
                    <span className="text-sm text-navy/50">
                      <span className={`font-semibold ${occText(selectedDayOcc)}`}>{pct(selectedDayOcc)}</span>
                      {" · "}{selectedDaySold}/{selectedDayTotal} plazas
                    </span>
                  </div>
                  <div className="space-y-3">
                    {selectedDayEvents.map((e) => (
                      <MobileClassCard key={e.id} event={e} onSelect={handleSelect} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── DESKTOP ────────────────────────────────────────────────────────── */}
        <div className="hidden sm:block">

          {tab === "analisis" && <HorarioReporting data={reportingData} />}

          {tab === "horario" && (
            <div>
              {/* Summary stats + week nav */}
              <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card px-5 py-4 mb-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                {events.length > 0 ? (
                  <>
                    <StatItem
                      label="Ocupación"
                      value={`${weekSoldSpots}/${weekTotalSpots} · ${pct(weekOcc)}`}
                      accent={weekOcc >= 0.8 ? "text-success" : weekOcc >= 0.5 ? "text-warning" : "text-danger"}
                    />
                    <div className="h-7 w-px bg-navy/[0.08]" />
                    <StatItem label="Plazas libres" value={`${weekFreeSpots}`} />
                    {lowCount > 0 && (
                      <>
                        <div className="h-7 w-px bg-navy/[0.08]" />
                        <span className="text-xs font-medium bg-warning/10 text-warning px-3 py-1.5 rounded-lg">
                          {lowCount} clase{lowCount !== 1 ? "s" : ""} por llenar
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-navy/40">Sin clases esta semana.</p>
                )}

                <div className="ml-auto flex items-center gap-1 bg-navy/[0.04] rounded-lg p-0.5">
                  <button
                    onClick={() => router.push(`?week=${prevWeek}`)}
                    disabled={weekMonday <= MIN_WEEK}
                    className="w-7 h-7 flex items-center justify-center rounded-md disabled:opacity-20 text-navy/50 hover:text-navy hover:bg-white transition-colors"
                  >
                    {chevLeft}
                  </button>
                  <span className="text-xs font-semibold text-navy px-1.5 min-w-[90px] text-center">
                    {weekLabel(weekMonday)}
                  </span>
                  <button
                    onClick={() => router.push(`?week=${nextWeek}`)}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-navy/50 hover:text-navy hover:bg-white transition-colors"
                  >
                    {chevRight}
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <Select value={claseFilter}       onChange={setClaseFilter}       options={clases}       placeholder="Todas las clases" />
                <Select value={instructoraFilter}  onChange={setInstructoraFilter}  options={instructoras}  placeholder="Todas las instructoras" />
                <div className="flex items-center border border-navy/[0.12] rounded-lg bg-white p-1 gap-0.5">
                  {([
                    { value: "all", label: "Todas" },
                    { value: "low", label: "Por llenar" },
                    { value: "mid", label: "A medias" },
                    { value: "high", label: "Llenas" },
                  ] as { value: OccFilter; label: string }[]).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setOccFilter(value)}
                      className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                        occFilter === value ? "bg-navy text-white font-medium" : "text-navy/50 hover:text-navy"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {hasFilters && (
                  <button
                    onClick={() => { setClaseFilter("all"); setInstructoraFilter("all"); setOccFilter("all"); }}
                    className="text-xs text-navy/50 hover:text-navy underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Color legend */}
              {events.length > 0 && (
                <div className="flex items-center gap-5 mb-4 flex-wrap">
                  {[
                    { color: "bg-[#c03828]", label: "Por llenar" },
                    { color: "bg-[#a38540]", label: "A medias" },
                    { color: "bg-[#c07030]", label: "Casi llena" },
                    { color: "bg-[#4e8a5d]", label: "Llena" },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                      <span className="text-xs text-navy/55">{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {events.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-navy/35 text-sm">No hay clases esta semana.</p>
                </div>
              ) : (
                <>
                  {mounted.lista && (
                    <div className={view === "lista" ? "" : "hidden"}>
                      <HorarioList days={days} onSelect={handleSelect} />
                    </div>
                  )}
                  {mounted.calendario && (
                    <div className={view === "calendario" ? "" : "hidden"}>
                      <HorarioCalendar events={filtered} weekMonday={weekMonday} onSelect={handleSelect} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drawer (shared) */}
      {selected && <HorarioDrawer event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── Mobile class card ──────────────────────────────────────────────────────────

function MobileClassCard({ event: e, onSelect }: { event: MomenceEvent; onSelect: (e: MomenceEvent) => void }) {
  const occ    = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
  const status = getOccStatus(occ);
  const time   = new Date(e.dateTime).toLocaleTimeString("es-ES", {
    timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit",
  });
  const DOTS       = 5;
  const filledDots = Math.min(Math.round(occ * DOTS), DOTS);

  return (
    <button
      onClick={() => onSelect(e)}
      className={`w-full text-left bg-white border border-navy/[0.07] border-l-4 rounded-xl shadow-card p-4 ${status.border}`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-sm text-navy/45">{time}</span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>
      <p className="text-base font-bold text-navy leading-snug">{e.title}</p>
      {e.teacher && <p className="text-sm text-navy/50 mt-0.5">{e.teacher}</p>}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: DOTS }, (_, i) => (
              <span key={i} className={`w-2 h-2 rounded-full ${i < filledDots ? status.dot : "bg-navy/15"}`} />
            ))}
          </div>
          <span className="text-xs text-navy/45">
            {e.spotsRemaining === 0 ? "completa" : `${e.spotsRemaining} libre${e.spotsRemaining !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-navy/40 tabular-nums">{e.ticketsSold}/{e.capacity}</span>
          <span className={`text-sm font-semibold tabular-nums ${status.text}`}>{Math.round(occ * 100)}%</span>
        </div>
      </div>
    </button>
  );
}

// ── Desktop sub-components ─────────────────────────────────────────────────────

function StatItem({ label, value, accent = "text-navy" }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[10px] text-navy/40 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none text-sm border border-navy/[0.12] rounded-lg bg-white text-navy pl-4 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer"
      >
        <option value="all">{placeholder}</option>
        {options.slice(1).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/40 pointer-events-none"
        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
