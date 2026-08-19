"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "react-feather";
import { pad2, resolveCalendarPeriod } from "@/lib/periodCalculation";
import Select from "@/app/components/Select";
import Button from "@/app/components/Button";
import HeaderPortal from "@/app/components/HeaderPortal";

const MONTHS = [
  { value: "month_01", label: "Enero" },
  { value: "month_02", label: "Febrero" },
  { value: "month_03", label: "Marzo" },
  { value: "month_04", label: "Abril" },
  { value: "month_05", label: "Mayo" },
  { value: "month_06", label: "Junio" },
  { value: "month_07", label: "Julio" },
  { value: "month_08", label: "Agosto" },
  { value: "month_09", label: "Septiembre" },
  { value: "month_10", label: "Octubre" },
  { value: "month_11", label: "Noviembre" },
  { value: "month_12", label: "Diciembre" },
];

const QUARTER_VALUES = ["q1", "q2", "q3", "q4"];

const WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];

const COMPARE_OPTIONS = [
  { value: "previous", label: "Período anterior" },
  { value: "year_ago", label: "Año anterior" },
  { value: "none", label: "Sin comparación" },
] as const;

const OLDEST_YEAR = 2025;

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function shiftISODate(iso: string, days: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

function CalendarMonth({
  year,
  month,
  rangeStart,
  rangeEnd,
  onDayClick,
}: {
  year: number;
  month: number; // 1-12
  rangeStart: Date | null;
  rangeEnd: Date | null;
  onDayClick: (d: Date) => void;
}) {
  const startOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday = 0
  const numDays = new Date(year, month, 0).getDate();
  const prevNumDays = new Date(year, month - 1, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 2, prevNumDays - i), inMonth: false });
  }
  for (let d = 1; d <= numDays; d++) {
    cells.push({ date: new Date(year, month - 1, d), inMonth: true });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month, nextDay), inMonth: false });
    nextDay++;
  }

  return (
    <div className="flex-1 min-w-[220px]">
      <p className="text-sm font-semibold text-navy text-center mb-2">
        {MONTHS[month - 1].label} {year}
      </p>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-[11px] text-navy/35">{w}</span>
        ))}
        {cells.map(({ date, inMonth }, i) => {
          const isStart = rangeStart && isSameDay(date, rangeStart);
          const isEnd = rangeEnd && isSameDay(date, rangeEnd);
          const ranged = rangeStart && rangeEnd && date >= rangeStart && date <= rangeEnd;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(date)}
              className={`h-8 text-sm rounded-full transition-colors ${
                !inMonth
                  ? "text-navy/25"
                  : isStart || isEnd
                  ? "bg-primary text-white font-semibold"
                  : ranged
                  ? "bg-primary/10 text-primary"
                  : "text-navy/70 hover:bg-navy/[0.05]"
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarRangePicker({
  initialFrom,
  initialTo,
  onApply,
}: {
  initialFrom: string;
  initialTo: string;
  onApply: (from: string, to: string) => void;
}) {
  const initStart = initialFrom ? fromISO(initialFrom) : null;
  const initEnd = initialTo ? fromISO(initialTo) : null;
  const base = initStart ?? new Date();

  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth() + 1); // left month, 1-12
  const [rangeStart, setRangeStart] = useState<Date | null>(initStart);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(initEnd);

  function shiftView(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function handleDayClick(d: Date) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d);
      setRangeEnd(null);
    } else if (d < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(d);
    } else {
      setRangeEnd(d);
    }
  }

  let rightMonth = viewMonth + 1;
  let rightYear = viewYear;
  if (rightMonth > 12) { rightMonth = 1; rightYear += 1; }

  return (
    <div className="border-t border-navy/[0.08] p-4 w-full sm:w-auto">
      <div className="flex items-start gap-2 sm:gap-3">
        <button type="button" onClick={() => shiftView(-1)} className="shrink-0 p-1 text-navy/40 hover:text-navy transition-colors">
          <ChevronLeft size={16} />
        </button>
        <CalendarMonth year={viewYear} month={viewMonth} rangeStart={rangeStart} rangeEnd={rangeEnd} onDayClick={handleDayClick} />
        <div className="hidden sm:block flex-1 min-w-[220px]">
          <CalendarMonth year={rightYear} month={rightMonth} rangeStart={rangeStart} rangeEnd={rangeEnd} onDayClick={handleDayClick} />
        </div>
        <button type="button" onClick={() => shiftView(1)} className="shrink-0 p-1 text-navy/40 hover:text-navy transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-3">
        <input
          type="date"
          value={rangeStart ? toISO(rangeStart) : ""}
          onChange={(e) => setRangeStart(e.target.value ? fromISO(e.target.value) : null)}
          className="flex-1 text-sm border border-navy/[0.15] rounded-lg px-3 py-2 shadow-[0px_2px_2px_var(--tw-shadow-color,#0000000d)] focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
        />
        <span className="text-navy/30 text-center sm:text-left">–</span>
        <input
          type="date"
          value={rangeEnd ? toISO(rangeEnd) : ""}
          onChange={(e) => setRangeEnd(e.target.value ? fromISO(e.target.value) : null)}
          className="flex-1 text-sm border border-navy/[0.15] rounded-lg px-3 py-2 shadow-[0px_2px_2px_var(--tw-shadow-color,#0000000d)] focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
        />
      </div>

      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={() => { setRangeStart(null); setRangeEnd(null); }}
          className="text-sm px-3 py-2 rounded-lg border border-navy/[0.12] text-navy/60 hover:bg-navy/[0.03] transition-colors"
        >
          Borrar
        </button>
        <Button
          disabled={!rangeStart}
          onClick={() => rangeStart && onApply(toISO(rangeStart), toISO(rangeEnd ?? rangeStart))}
        >
          Aplicar
        </Button>
      </div>
    </div>
  );
}

function AnaliticaFilterBarInner({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const now = new Date();
  const currentYear = now.getFullYear();

  const period = sp.get("period") ?? "year";
  const year = parseInt(sp.get("year") ?? String(currentYear)) || currentYear;
  const compareWith = sp.get("compareWith") ?? "previous";
  const customFrom = sp.get("from") ?? "";
  const customTo = sp.get("to") ?? "";

  const availableYears: number[] = [];
  for (let y = currentYear; y >= OLDEST_YEAR; y--) availableYears.push(y);

  const [open, setOpen] = useState(false);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cambiar de período dispara una navegación que vuelve a pedir datos de Stripe/Momence
  // en el servidor (puede tardar varios segundos): reflejamos la selección al instante aquí
  // en vez de esperar a que useSearchParams() se actualice cuando la navegación termine.
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<{ period: string; year: string; from: string; to: string } | null>(null);

  useEffect(() => {
    if (!optimistic) return;
    if (optimistic.period === period && optimistic.year === String(year) && optimistic.from === customFrom && optimistic.to === customTo) {
      setOptimistic(null);
    }
  }, [optimistic, period, year, customFrom, customTo]);

  const activePeriod = optimistic?.period ?? period;
  const activeYear = optimistic ? parseInt(optimistic.year) || currentYear : year;
  const activeFrom = optimistic?.from ?? customFrom;
  const activeTo = optimistic?.to ?? customTo;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setExpandedYear(null);
        setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  function selectPeriod(newPeriod: string, newYear?: number) {
    const yearStr = newYear ? String(newYear) : String(activeYear);
    setOptimistic({ period: newPeriod, year: yearStr, from: "", to: "" });
    update({ period: newPeriod, year: newYear ? String(newYear) : null, from: null, to: null });
    setOpen(false);
    setExpandedYear(null);
    setShowCustom(false);
  }

  function applyCustom(from: string, to: string) {
    setOptimistic({ period: "custom", year: String(activeYear), from, to });
    update({ period: "custom", from, to, year: null });
    setOpen(false);
    setShowCustom(false);
  }

  function step(direction: 1 | -1) {
    if (activePeriod === "all") return;

    if (activePeriod === "custom" && activeFrom && activeTo) {
      const durationDays = Math.round((fromISO(activeTo).getTime() - fromISO(activeFrom).getTime()) / 86400000) + 1;
      const newFrom = shiftISODate(activeFrom, direction * durationDays);
      const newTo = shiftISODate(activeTo, direction * durationDays);
      setOptimistic({ period: "custom", year: String(activeYear), from: newFrom, to: newTo });
      update({ from: newFrom, to: newTo });
      return;
    }

    if (activePeriod === "year") {
      const newYear = activeYear + direction;
      setOptimistic({ period: "year", year: String(newYear), from: "", to: "" });
      update({ year: String(newYear) });
      return;
    }

    const qMatch = /^q([1-4])$/.exec(activePeriod);
    if (qMatch) {
      let q = parseInt(qMatch[1]) + direction;
      let y = activeYear;
      if (q < 1) { q = 4; y -= 1; }
      if (q > 4) { q = 1; y += 1; }
      setOptimistic({ period: `q${q}`, year: String(y), from: "", to: "" });
      update({ period: `q${q}`, year: String(y) });
      return;
    }

    const mMatch = /^month_(\d{2})$/.exec(activePeriod);
    if (mMatch) {
      let m = parseInt(mMatch[1]) + direction;
      let y = activeYear;
      if (m < 1) { m = 12; y -= 1; }
      if (m > 12) { m = 1; y += 1; }
      setOptimistic({ period: `month_${pad2(m)}`, year: String(y), from: "", to: "" });
      update({ period: `month_${pad2(m)}`, year: String(y) });
    }
  }

  const label = resolveCalendarPeriod({
    period: activePeriod,
    year: String(activeYear),
    compareWith,
    from: activeFrom,
    to: activeTo,
  }).periodLabel;

  const disabled = activePeriod === "all";

  return (
    <div className={compact ? "flex items-center gap-2" : "flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-3 sm:gap-2 mb-4 pb-4 border-b border-border"}>
      <div ref={ref} className="relative">
        <div className="flex items-center bg-card border border-border rounded-[8px] text-navy overflow-hidden w-full sm:w-auto">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={disabled}
            className="shrink-0 p-1.5 text-navy/40 hover:text-navy hover:bg-navy/[0.05] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex-1 flex items-center justify-center gap-2 px-2 py-1.5 text-sm font-semibold outline-none cursor-pointer hover:bg-navy/[0.03] transition-colors"
          >
            <span className={isPending ? "opacity-50 transition-opacity" : "transition-opacity"}>{label}</span>
            {isPending ? (
              <span className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" />
            ) : (
              <ChevronDown size={12} className={`shrink-0 text-navy/35 transition-transform ${open ? "rotate-180" : ""}`} />
            )}
          </button>

          <button
            type="button"
            onClick={() => step(1)}
            disabled={disabled}
            className="shrink-0 p-1.5 text-navy/40 hover:text-navy hover:bg-navy/[0.05] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {open && (
            <div className="absolute left-0 top-full mt-1.5 z-50 bg-card border border-border rounded-[8px] shadow-lg overflow-hidden max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col sm:flex-row">
                <ul className="py-1 w-full sm:min-w-[220px]">
                  {availableYears.map((y) => (
                    <li key={y}>
                      <button
                        type="button"
                        onClick={() => setExpandedYear(expandedYear === y ? null : y)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-sm transition-colors ${
                          expandedYear === y
                            ? "bg-primary/[0.06] text-primary font-medium"
                            : activePeriod !== "all" && activePeriod !== "custom" && activeYear === y
                            ? "text-primary font-medium hover:bg-navy/[0.04]"
                            : "text-navy/70 hover:bg-navy/[0.04] hover:text-navy"
                        }`}
                      >
                        <span>Año {y}</span>
                        <ChevronRight size={13} className="text-navy/30" />
                      </button>
                    </li>
                  ))}
                  <li className="border-t border-navy/[0.08] mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => { setShowCustom((s) => !s); setExpandedYear(null); }}
                      className={`w-full text-left whitespace-nowrap px-4 py-2 text-sm transition-colors ${
                        showCustom || activePeriod === "custom"
                          ? "text-primary font-medium bg-primary/[0.06]"
                          : "text-navy/70 hover:bg-navy/[0.04] hover:text-navy"
                      }`}
                    >
                      Período personalizado
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => selectPeriod("all")}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        activePeriod === "all"
                          ? "text-primary font-medium bg-primary/[0.06]"
                          : "text-navy/70 hover:bg-navy/[0.04] hover:text-navy"
                      }`}
                    >
                      Desde el inicio
                    </button>
                  </li>
                </ul>

                {expandedYear && (
                  <ul className="py-1 w-full sm:min-w-[150px] border-t sm:border-t-0 sm:border-l border-navy/[0.08] max-h-80 overflow-y-auto">
                    <li className="border-b border-navy/[0.08] pb-1 mb-1">
                      <button
                        type="button"
                        onClick={() => selectPeriod("year", expandedYear)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          activePeriod === "year" && activeYear === expandedYear
                            ? "text-primary font-medium bg-primary/[0.06]"
                            : "text-navy/70 hover:bg-navy/[0.04] hover:text-navy"
                        }`}
                      >
                        Año completo
                      </button>
                    </li>
                    {QUARTER_VALUES.map((q, i) => (
                      <li key={q} className={i === QUARTER_VALUES.length - 1 ? "border-b border-navy/[0.08] pb-1 mb-1" : undefined}>
                        <button
                          type="button"
                          onClick={() => selectPeriod(q, expandedYear)}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            activePeriod === q && activeYear === expandedYear
                              ? "text-primary font-medium bg-primary/[0.06]"
                              : "text-navy/70 hover:bg-navy/[0.04] hover:text-navy"
                          }`}
                        >
                          {i + 1}T {expandedYear}
                        </button>
                      </li>
                    ))}
                    {MONTHS.map((m) => (
                      <li key={m.value}>
                        <button
                          type="button"
                          onClick={() => selectPeriod(m.value, expandedYear)}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            activePeriod === m.value && activeYear === expandedYear
                              ? "text-primary font-medium bg-primary/[0.06]"
                              : "text-navy/70 hover:bg-navy/[0.04] hover:text-navy"
                          }`}
                        >
                          {m.label} {expandedYear}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {showCustom && (
                <CalendarRangePicker initialFrom={customFrom} initialTo={customTo} onApply={applyCustom} />
              )}
            </div>
          )}
      </div>

      {/* Compare with - disabled when period is "all" */}
      <div className={`${compact ? "flex items-center gap-2" : "flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 sm:ml-auto"} ${disabled ? "opacity-35 pointer-events-none" : ""}`}>
        <span className="text-[11px] text-navy/40 whitespace-nowrap">Comparar con</span>
        <Select value={compareWith} onChange={(e) => update({ compareWith: e.target.value })}>
          {COMPARE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}

export default function AnaliticaFilterBar() {
  return (
    <>
      {/* Escritorio: junto al título, en el header sticky (sin padding lateral propio). */}
      <HeaderPortal target="header-actions">
        <div className="hidden sm:block">
          <Suspense fallback={<div className="h-9 w-64" />}>
            <AnaliticaFilterBarInner compact />
          </Suspense>
        </div>
      </HeaderPortal>
      {/* Móvil: se queda donde estaba, debajo de las pestañas. */}
      <div className="sm:hidden">
        <Suspense fallback={<div className="h-10 mb-4" />}>
          <AnaliticaFilterBarInner />
        </Suspense>
      </div>
    </>
  );
}
