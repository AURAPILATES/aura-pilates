"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MomenceEvent } from "@/lib/momence";
import { groupByDay, occupancyRate, pct } from "@/lib/analytics";
import HorarioList from "./HorarioList";
import HorarioCalendar from "./HorarioCalendar";
import HorarioDrawer from "./HorarioDrawer";
import HorarioReporting, { type ReportingData } from "./HorarioReporting";
import ClientesFilterBar from "@/app/clientes/ClientesFilterBar";

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
  const todayISO = new Date().toISOString().split("T")[0];
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const key    = addDays(weekMonday, i);
      const d      = new Date(key + "T12:00:00");
      const dayEvs = events.filter((e) => e.dateTime.startsWith(key));
      return { key, letter: DAY_LETTERS[i], num: d.getDate(), hasEvents: dayEvs.length > 0, isToday: key === todayISO, occ: occupancyRate(dayEvs) };
    }),
    [weekMonday, events],
  );

  const firstLowDay = useMemo(
    () => weekDays.find((d) => d.hasEvents && events.some((e) => e.dateTime.startsWith(d.key) && e.capacity > 0 && e.ticketsSold / e.capacity < 0.5))?.key ?? null,
    [weekDays, events],
  );

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
          {/* Left: title + tabs (desktop) */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-navy uppercase tracking-widest">Horario</span>
            <div className="hidden sm:flex items-center border border-navy/[0.12] rounded-lg bg-white p-0.5 gap-0.5">
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

          {/* Right: tabs (mobile) + week nav + view toggle (desktop) */}
          <div className="flex items-center gap-2">
            {/* Tabs — mobile only, right side */}
            <div className="sm:hidden flex items-center border border-navy/[0.12] rounded-lg bg-white p-0.5 gap-0.5">
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

            {/* Desktop: week nav + view toggle — horario tab only */}
            {tab === "horario" && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => router.push(`?week=${prevWeek}`)}
                  disabled={weekMonday <= MIN_WEEK}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-navy/[0.12] bg-white text-navy/50 disabled:opacity-20 hover:text-navy hover:bg-navy/[0.03] transition-colors"
                >
                  {chevLeft}
                </button>
                <span className="text-xs font-semibold text-navy px-2 min-w-[110px] text-center">
                  Semana {weekLabel(weekMonday)}
                </span>
                <button
                  onClick={() => router.push(`?week=${nextWeek}`)}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-navy/[0.12] bg-white text-navy/50 hover:text-navy hover:bg-navy/[0.03] transition-colors"
                >
                  {chevRight}
                </button>
              </div>
              <div className="w-px h-5 bg-navy/[0.12]" />
              <div className="flex border border-navy/[0.08] rounded-lg overflow-hidden bg-white text-xs">
                <button
                  onClick={() => setView("lista")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${view === "lista" ? "bg-navy text-white font-medium" : "text-navy/50 hover:text-navy"}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  Lista
                </button>
                <button
                  onClick={() => setView("calendario")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${view === "calendario" ? "bg-navy text-white font-medium" : "text-navy/50 hover:text-navy"}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Calendario
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CONTENT
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16">

        {/* ── MOBILE ─────────────────────────────────────────────────────────── */}
        <div className="sm:hidden">
          {tab === "analisis" ? (
            <>
              <ClientesFilterBar defaultPeriod="" />
              <HorarioReporting data={reportingData} />
            </>
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
                      <span className="text-5xl font-medium text-navy leading-none">{Math.round(weekOcc * 100)}</span>
                      <span className="text-2xl font-medium text-navy mb-0.5">%</span>
                    </div>
                    <div className="mb-1">
                      <p className="text-xs text-navy/45 leading-tight">ocupación</p>
                      <p className="text-xs text-navy/45 leading-tight">media semana</p>
                    </div>
                  </div>
                  <div className="border-t border-navy/[0.06] grid grid-cols-3 divide-x divide-navy/[0.06]">
                    <div className="px-4 py-3">
                      <p className="text-[9px] text-navy/40 uppercase tracking-widest font-semibold">Vendidas</p>
                      <p className="text-base font-medium text-navy mt-0.5 tabular-nums">{weekSoldSpots}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-[9px] text-navy/40 uppercase tracking-widest font-semibold">Libres</p>
                      <p className="text-base font-medium text-navy mt-0.5 tabular-nums">{weekFreeSpots}</p>
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

              {/* Alert: low occupancy */}
              {lowCount > 0 && (
                <div className="flex items-center justify-between gap-3 bg-warning/[0.08] border border-warning/20 rounded-xl px-4 py-3 mb-5">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning shrink-0">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <span className="text-sm text-warning font-medium leading-snug">
                      {lowCount} clase{lowCount !== 1 ? "s" : ""} con baja ocupación esta semana
                    </span>
                  </div>
                  {firstLowDay && (
                    <button
                      onClick={() => document.getElementById(`mday-${firstLowDay}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className="shrink-0 text-sm font-semibold text-warning border border-warning/30 rounded-lg px-3 py-1.5 hover:bg-warning/10 transition-colors"
                    >
                      Ver →
                    </button>
                  )}
                </div>
              )}

              {/* Day pills — tap to scroll to that day */}
              <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-none">
                {weekDays.map((day) => {
                  const status = day.hasEvents ? getOccStatus(day.occ) : null;
                  return (
                    <button
                      key={day.key}
                      onClick={() => document.getElementById(`mday-${day.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className={`shrink-0 flex flex-col items-center w-[52px] py-2.5 rounded-xl transition-colors ${
                        day.isToday
                          ? "bg-navy text-white"
                          : day.hasEvents
                          ? "bg-white border border-navy/[0.12] text-navy"
                          : "bg-white border border-navy/[0.07] text-navy/25"
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide">{day.letter}</span>
                      <span className="text-xl font-bold leading-none mt-1">{day.num}</span>
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                        !day.hasEvents ? "opacity-0" : day.isToday ? "bg-white/50" : status!.dot
                      }`} />
                    </button>
                  );
                })}
              </div>

              {/* Occ filter pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 mb-5 scrollbar-none">
                {([
                  { value: "all",  label: "Todas",      dot: "bg-navy/25" },
                  { value: "low",  label: "Por llenar", dot: "bg-[#c03828]" },
                  { value: "mid",  label: "A medias",   dot: "bg-[#a38540]" },
                  { value: "high", label: "Llenas",     dot: "bg-[#4e8a5d]" },
                ] as { value: OccFilter; label: string; dot: string }[]).map(({ value, label, dot }) => (
                  <button
                    key={value}
                    onClick={() => setOccFilter(value)}
                    className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-full border transition-colors ${
                      occFilter === value
                        ? "bg-navy text-white border-navy"
                        : "bg-white text-navy/60 border-navy/[0.12] hover:text-navy"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${occFilter === value ? "bg-white/60" : dot}`} />
                    {label}
                  </button>
                ))}
              </div>

              {/* All days — continuous scroll */}
              {days.length === 0 ? (
                <p className="text-sm text-navy/40 text-center py-10">Sin clases con estos filtros.</p>
              ) : (
                <div className="space-y-8">
                  {days.map(({ dateKey, events: dayEvs }) => {
                    const dayOcc  = occupancyRate(dayEvs);
                    const daySold = dayEvs.reduce((s, e) => s + e.ticketsSold, 0);
                    const dayTotal = dayEvs.reduce((s, e) => s + e.capacity, 0);
                    const dName = new Date(dateKey + "T12:00:00").toLocaleDateString("es-ES", {
                      weekday: "long", timeZone: "Europe/Madrid",
                    });
                    const dNum = new Date(dateKey + "T12:00:00").getDate();
                    return (
                      <div key={dateKey} id={`mday-${dateKey}`}>
                        <div className="flex items-baseline justify-between mb-3">
                          <h2 className="text-2xl font-bold text-navy capitalize">
                            {dName} <span className="font-light text-xl">{dNum}</span>
                          </h2>
                          <span className="text-sm text-navy/50">
                            <span className={`font-semibold ${occText(dayOcc)}`}>{pct(dayOcc)}</span>
                            {" · "}{daySold}/{dayTotal}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {dayEvs.map((e) => (
                            <MobileClassCard key={e.id} event={e} onSelect={handleSelect} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── DESKTOP ────────────────────────────────────────────────────────── */}
        <div className="hidden sm:block">

          {tab === "analisis" && (
            <>
              <ClientesFilterBar defaultPeriod="" />
              <HorarioReporting data={reportingData} />
            </>
          )}

          {tab === "horario" && (
            <div>
              {/* Stats cards */}
              {events.length === 0 ? (
                <p className="text-sm text-navy/40 mb-6">Sin clases esta semana.</p>
              ) : (
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card px-5 py-4">
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-medium text-navy leading-none">{Math.round(weekOcc * 100)}</span>
                      <span className="text-2xl font-medium text-navy mb-0.5">%</span>
                      <div className="mb-1">
                        <p className="text-xs text-navy/45 leading-tight">ocupación</p>
                        <p className="text-xs text-navy/45 leading-tight">media semana</p>
                      </div>
                    </div>
                  </div>
                  <DesktopStatCard label="VENDIDAS" value={String(weekSoldSpots)} />
                  <DesktopStatCard label="LIBRES"   value={String(weekFreeSpots)} />
                  <DesktopStatCard label="POR LLENAR" value={String(lowCount)} valueClass={lowCount > 0 ? "text-danger" : "text-navy/30"} />
                </div>
              )}

              {/* Alert banner */}

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <Select value={claseFilter}       onChange={setClaseFilter}       options={clases}       placeholder="Todas las clases" />
                <Select value={instructoraFilter}  onChange={setInstructoraFilter}  options={instructoras}  placeholder="Todas las instructoras" />
                <div className="flex items-center border border-navy/[0.12] rounded-lg bg-white p-1 gap-0.5">
                  {([
                    { value: "all",  label: "Todas",      dot: "bg-navy/25" },
                    { value: "low",  label: "Por llenar", dot: "bg-[#c03828]" },
                    { value: "mid",  label: "A medias",   dot: "bg-[#a38540]" },
                    { value: "high", label: "Llenas",     dot: "bg-[#4e8a5d]" },
                  ] as { value: OccFilter; label: string; dot: string }[]).map(({ value, label, dot }) => (
                    <button
                      key={value}
                      onClick={() => setOccFilter(value)}
                      className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors ${
                        occFilter === value ? "bg-navy text-white font-medium" : "text-navy/50 hover:text-navy"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${occFilter === value ? "bg-white/60" : dot}`} />
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
      <div className="mt-3">
        <div className="h-1 bg-navy/[0.08] rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full ${status.dot}`} style={{ width: `${Math.round(occ * 100)}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-navy/45 tabular-nums">
            {e.ticketsSold}/{e.capacity} · {e.spotsRemaining === 0 ? "completa" : `${e.spotsRemaining} libre${e.spotsRemaining !== 1 ? "s" : ""}`}
          </span>
          <span className={`text-sm font-semibold tabular-nums ${status.text}`}>{Math.round(occ * 100)}%</span>
        </div>
      </div>
    </button>
  );
}

// ── Desktop sub-components ─────────────────────────────────────────────────────

function DesktopStatCard({ label, value, valueClass = "text-navy" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card px-5 py-4">
      <p className="text-[9px] text-navy/40 uppercase tracking-widest font-semibold mb-2">{label}</p>
      <p className={`text-3xl font-medium tabular-nums ${valueClass}`}>{value}</p>
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
