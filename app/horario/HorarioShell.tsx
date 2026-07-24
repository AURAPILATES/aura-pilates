"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MomenceEvent } from "@/lib/momence";
import { groupByDay, occupancyRate, pct } from "@/lib/analytics";
import HorarioList from "./HorarioList";
import HorarioCalendar from "./HorarioCalendar";
import HorarioDrawer from "./HorarioDrawer";
import MobileNav from "@/app/components/MobileNav";
import { ToggleGroup } from "@/components/charts";
import SharedSelect from "@/app/components/Select";

type OccFilter = "all" | "low" | "mid" | "high";
type View = "lista" | "calendario";

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
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
  if (occ >= 1.0) return { label: "✓ Llena",   bg: "bg-[#eaf4ee] dark:bg-[#193324]", text: "text-[#4e8a5d] dark:text-[#8dce9d]", border: "border-l-[#4e8a5d]", dot: "bg-[#4e8a5d] dark:bg-[#8dce9d]" };
  if (occ >= 0.5) return { label: "A medias",  bg: "bg-[#f5f0e0] dark:bg-[#393013]", text: "text-[#a38540] dark:text-[#ceba8d]", border: "border-l-[#a38540]", dot: "bg-[#a38540] dark:bg-[#ceba8d]" };
  return             { label: "Por llenar", bg: "bg-[#fdecea] dark:bg-[#391713]", text: "text-[#c03828] dark:text-[#d88c83]", border: "border-l-[#c03828]", dot: "bg-[#c03828] dark:bg-[#d88c83]" };
}

const MIN_WEEK    = "2026-06-15";
const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

export default function HorarioShell({
  events,
  hiddenEvents,
  weekMonday,
  initialView,
}: {
  events: MomenceEvent[];
  hiddenEvents: MomenceEvent[];
  weekMonday: string;
  initialView: View;
}) {
  const router = useRouter();
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
      if (occFilter === "mid"  && (occ < 0.5 || occ >= 1.0)) return false;
      if (occFilter === "high" && occ < 1.0) return false;
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
  const almostEmptyCount = events.filter((e) => e.ticketsSold <= 2).length;

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
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[45px] flex items-center gap-3">
          <MobileNav />
          <span className="text-sm font-bold text-navy uppercase tracking-widest">Horario</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CONTENT
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-6 pb-16">

        {/* Week nav / view toggle (desktop) */}
        <div className="hidden sm:flex items-center justify-start gap-3 mb-6">
          <div className="flex items-center gap-2 shrink-0 pb-2">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => router.push(`?week=${prevWeek}`)}
                  disabled={weekMonday <= MIN_WEEK}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-navy/[0.12] bg-card text-navy/50 disabled:opacity-20 hover:text-navy hover:bg-navy/[0.03] transition-colors"
                >
                  {chevLeft}
                </button>
                <span className="text-[14px] font-semibold text-navy px-2 min-w-[110px] text-center">
                  Semana {weekLabel(weekMonday)}
                </span>
                <button
                  onClick={() => router.push(`?week=${nextWeek}`)}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-navy/[0.12] bg-card text-navy/50 hover:text-navy hover:bg-navy/[0.03] transition-colors"
                >
                  {chevRight}
                </button>
              </div>
              <div className="w-px h-5 bg-navy/[0.12]" />
              <ToggleGroup
                options={[
                  {
                    value: "calendario",
                    label: "Calendario",
                    icon: (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    ),
                  },
                  {
                    value: "lista",
                    label: "Lista",
                    icon: (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                        <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                      </svg>
                    ),
                  },
                ]}
                value={view}
                onChange={(v) => setView(v as typeof view)}
              />
          </div>
        </div>

        {hiddenEvents.length > 0 && (
          <HiddenEventsPanel events={hiddenEvents} />
        )}

        {/* ── MOBILE ─────────────────────────────────────────────────────────── */}
        <div className="sm:hidden">
              {/* Week nav */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-navy/50">Semana {weekLabel(weekMonday)}</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => router.push(`?week=${prevWeek}`)}
                    disabled={weekMonday <= MIN_WEEK}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-navy/[0.12] bg-card text-navy/50 disabled:opacity-20"
                  >
                    {chevLeft}
                  </button>
                  <button
                    onClick={() => router.push(`?week=${nextWeek}`)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-navy/[0.12] bg-card text-navy/50"
                  >
                    {chevRight}
                  </button>
                </div>
              </div>

              {/* Stats card */}
              {events.length > 0 && (
                <div className="bg-card border border-navy/[0.07] rounded-xl shadow-card mb-4 overflow-hidden">
                  <div className="px-4 pt-4 pb-3 flex items-end gap-2.5">
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-medium text-navy leading-none">{Math.round(weekOcc * 100)}</span>
                      <span className="text-xl font-medium text-navy mb-0.5">%</span>
                    </div>
                    <div className="mb-0.5">
                      <p className="text-xs text-navy/45 leading-tight">ocupación</p>
                      <p className="text-xs text-navy/45 leading-tight">media semana</p>
                    </div>
                  </div>
                  <div className="border-t border-navy/[0.06] grid grid-cols-3 divide-x divide-navy/[0.06]">
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] text-navy/40 uppercase tracking-widest font-semibold">Plazas vendidas</p>
                      <p className="text-sm font-medium text-navy mt-0.5 tabular-nums">{weekSoldSpots}</p>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] text-navy/40 uppercase tracking-widest font-semibold">Plazas libres</p>
                      <p className="text-sm font-medium text-navy mt-0.5 tabular-nums">{weekFreeSpots}</p>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] text-navy/40 uppercase tracking-widest font-semibold" title="Clases con 2 o menos plazas vendidas">Casi vacías</p>
                      <p className={`text-sm font-semibold mt-0.5 tabular-nums ${almostEmptyCount > 0 ? "text-danger" : "text-navy/30"}`}>
                        {almostEmptyCount}
                      </p>
                    </div>
                  </div>
                </div>
              )}


              {/* Day pills — tap to scroll to that day */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2.5 scrollbar-none">
                {weekDays.map((day) => {
                  const status = day.hasEvents ? getOccStatus(day.occ) : null;
                  return (
                    <button
                      key={day.key}
                      disabled={!day.hasEvents}
                      onClick={() => document.getElementById(`mday-${day.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className={`shrink-0 flex flex-col items-center w-[44px] py-2 rounded-lg transition-colors ${
                        day.hasEvents
                          ? "bg-card border border-navy/[0.12] text-navy"
                          : "bg-navy/[0.03] border border-navy/[0.06] text-navy/25"
                      }`}
                    >
                      <span className="text-[9px] font-semibold uppercase tracking-wide">{day.letter}</span>
                      <span className="text-base font-medium leading-none mt-1">{day.num}</span>
                      <span className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        !day.hasEvents ? "opacity-0" : status!.dot
                      }`} />
                    </button>
                  );
                })}
              </div>

              {/* Occ filter pills */}
              <div className="mb-4">
                <OccFilterGroup occFilter={occFilter} onChange={setOccFilter} />
              </div>

              {/* All days — continuous scroll */}
              {days.length === 0 ? (
                <p className="text-sm text-navy/40 text-center py-10">Sin clases con estos filtros.</p>
              ) : (
                <div className="space-y-6">
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
                        <div className="flex items-baseline justify-between mb-2.5">
                          <h2 className="text-lg font-medium text-navy capitalize">
                            {dName} <span className="font-medium text-base">{dNum}</span>
                          </h2>
                          <span className="text-xs text-navy/50">
                            <span className={`font-semibold ${occText(dayOcc)}`}>{pct(dayOcc)}</span>
                            {" · "}{daySold}/{dayTotal}
                          </span>
                        </div>
                        <div className="border border-navy/[0.07] rounded-xl divide-y divide-navy/[0.06] overflow-hidden">
                          {dayEvs.map((e) => (
                            <MobileClassCard key={e.id} event={e} onSelect={handleSelect} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
        </div>

        {/* ── DESKTOP ────────────────────────────────────────────────────────── */}
        <div className="hidden sm:block">
            <div>
              {/* Stats cards */}
              {events.length === 0 ? (
                <p className="text-sm text-navy/40 mb-6">Sin clases esta semana.</p>
              ) : (
                <div className="grid grid-cols-4 gap-3 mb-5">
                  <KpiCard label="Ocupación media esta semana" value={`${Math.round(weekOcc * 100)}%`} valueColor={occText(weekOcc)} />
                  <KpiCard label="Plazas vendidas" value={String(weekSoldSpots)} />
                  <KpiCard label="Plazas libres"   value={String(weekFreeSpots)} />
                  <KpiCard
                    label="Clases casi vacías"
                    value={String(almostEmptyCount)}
                    valueColor={almostEmptyCount > 0 ? "text-danger" : "text-navy/30"}
                    tooltip="Clases con 2 o menos plazas vendidas"
                  />
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5 mb-5">
                <Select value={claseFilter}       onChange={setClaseFilter}       options={clases}       placeholder="Todas las clases" />
                <Select value={instructoraFilter}  onChange={setInstructoraFilter}  options={instructoras}  placeholder="Todas las instructoras" />
                <OccFilterGroup occFilter={occFilter} onChange={setOccFilter} />
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
  const pctVal = Math.round(occ * 100);
  const time   = new Date(e.dateTime).toLocaleTimeString("es-ES", {
    timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit",
  });

  return (
    <button
      onClick={() => onSelect(e)}
      className="w-full text-left bg-card p-3.5 flex items-center gap-3"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
      <span className="font-mono text-xs text-navy/45 shrink-0">{time}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-navy truncate">{e.title}</p>
        {e.teacher && <p className="text-xs text-navy/50 truncate">{e.teacher}</p>}
      </div>
      <div className="w-16 shrink-0">
        <div className="h-1 bg-navy/[0.08] rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${status.dot}`} style={{ width: `${pctVal}%` }} />
        </div>
      </div>
      <span className={`text-xs font-semibold tabular-nums w-9 text-right shrink-0 ${status.text}`}>{pctVal}%</span>
    </button>
  );
}

// ── Panel temporal: clases ocultas (canceladas / sin publicar / eliminadas) ─────

function HiddenEventsPanel({ events }: { events: MomenceEvent[] }) {
  const [open, setOpen] = useState(false);
  const sorted = [...events].sort((a, b) => a.dateTime.localeCompare(b.dateTime));

  function reason(e: MomenceEvent) {
    if (e.isDeleted) return { label: "Eliminada", cls: "bg-navy/10 text-navy/50" };
    if (e.isCancelled) return { label: "Cancelada", cls: "bg-[#fdecea] dark:bg-[#391713] text-[#c03828] dark:text-[#d88c83]" };
    if (!e.published) return { label: "Sin publicar", cls: "bg-[#fdf0e5] dark:bg-[#392513] text-[#c07030] dark:text-[#d5a986]" };
    return { label: "—", cls: "bg-navy/10 text-navy/50" };
  }

  return (
    <div className="bg-[#fdf6ec] dark:bg-[#392a13] border border-[#e8d9bb] dark:border-[#6f582a] rounded-xl mb-4 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-xs font-medium text-[#8a6a30] dark:text-[#ceb78d]">
          {events.length} clase{events.length !== 1 ? "s" : ""} oculta{events.length !== 1 ? "s" : ""} esta semana (canceladas / sin publicar / eliminadas)
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`text-[#8a6a30] dark:text-[#ceb78d] shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[#e8d9bb] dark:border-[#6f582a] divide-y divide-[#e8d9bb]/70 dark:divide-[#6f582a]/70">
          {sorted.map((e) => {
            const d = new Date(e.dateTime);
            const r = reason(e);
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                <span className="text-navy/50 font-mono w-28 shrink-0">
                  {d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Madrid" })}
                </span>
                <span className="text-navy/50 font-mono w-12 shrink-0">
                  {d.toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="flex-1 min-w-0 truncate text-navy font-medium">{e.title}</span>
                {e.teacher && <span className="text-navy/45 shrink-0">{e.teacher}</span>}
                <span className={`px-2 py-0.5 rounded-full font-medium shrink-0 ${r.cls}`}>{r.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Desktop sub-components ─────────────────────────────────────────────────────

function KpiCard({ label, value, valueColor = "text-navy", tooltip }: {
  label: string; value: string; valueColor?: string; tooltip?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-[14px] px-4 py-3">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[11px] font-semibold text-navy/50 uppercase tracking-wider leading-tight">{label}</p>
        {tooltip && (
          <span className="relative group/tip inline-flex items-center">
            <svg
              width="12" height="12" viewBox="0 0 16 16" fill="none"
              className="text-navy/30 hover:text-navy/55 transition-colors cursor-default shrink-0"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 7v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="4.5" r="0.75" fill="currentColor"/>
            </svg>
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] rounded-lg bg-navy-solid px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 whitespace-normal text-center">
              {tooltip}
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-navy" />
            </span>
          </span>
        )}
      </div>
      <p className={`text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
    </div>
  );
}

/** Segmentado Todas/Por llenar/A medias/Llenas — mismo componente en escritorio y móvil. */
function OccFilterGroup({ occFilter, onChange }: { occFilter: OccFilter; onChange: (v: OccFilter) => void }) {
  return (
    <div className="overflow-x-auto scrollbar-none">
      <div className="inline-flex items-center gap-0.5 bg-navy/5 p-[3px] rounded-[10px] w-max min-w-full sm:min-w-0">
        {([
          { value: "all",  label: "Todas",      dot: "bg-navy/25" },
          { value: "low",  label: "Por llenar", dot: "bg-[#c03828] dark:bg-[#d88c83]" },
          { value: "mid",  label: "A medias",   dot: "bg-[#a38540] dark:bg-[#ceba8d]" },
          { value: "high", label: "Llenas",     dot: "bg-[#4e8a5d] dark:bg-[#8dce9d]" },
        ] as { value: OccFilter; label: string; dot: string }[]).map(({ value, label, dot }) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-[7px] whitespace-nowrap transition-colors ${
              occFilter === value
                ? "bg-card text-navy font-medium border border-navy/[0.07]"
                : "text-navy/50 hover:text-navy"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  return (
    <SharedSelect value={value} onChange={(e) => onChange(e.target.value)} className="w-auto">
      <option value="all">{placeholder}</option>
      {options.slice(1).map((o) => <option key={o} value={o}>{o}</option>)}
    </SharedSelect>
  );
}
