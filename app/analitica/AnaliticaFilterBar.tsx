"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "react-feather";
import { pad2, resolveCalendarPeriod } from "@/lib/periodCalculation";

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

function SelectPill({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-white border border-navy/[0.13] rounded-xl pl-3 pr-7 py-1.5 text-sm font-semibold text-navy shadow-sm outline-none cursor-pointer hover:border-navy/25 transition-colors"
      >
        {children}
      </select>
      <ChevronDown size={12} className="absolute right-2 text-navy/35 pointer-events-none" />
    </div>
  );
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
    <div className="border-t border-navy/[0.08] p-4">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => shiftView(-1)} className="p-1 text-navy/40 hover:text-navy transition-colors">
          <ChevronLeft size={16} />
        </button>
        <CalendarMonth year={viewYear} month={viewMonth} rangeStart={rangeStart} rangeEnd={rangeEnd} onDayClick={handleDayClick} />
        <CalendarMonth year={rightYear} month={rightMonth} rangeStart={rangeStart} rangeEnd={rangeEnd} onDayClick={handleDayClick} />
        <button type="button" onClick={() => shiftView(1)} className="p-1 text-navy/40 hover:text-navy transition-colors">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <input
          type="date"
          value={rangeStart ? toISO(rangeStart) : ""}
          onChange={(e) => setRangeStart(e.target.value ? fromISO(e.target.value) : null)}
          className="flex-1 text-sm border border-navy/[0.15] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
        />
        <span className="text-navy/30">–</span>
        <input
          type="date"
          value={rangeEnd ? toISO(rangeEnd) : ""}
          onChange={(e) => setRangeEnd(e.target.value ? fromISO(e.target.value) : null)}
          className="flex-1 text-sm border border-navy/[0.15] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
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
        <button
          type="button"
          disabled={!rangeStart}
          onClick={() => rangeStart && onApply(toISO(rangeStart), toISO(rangeEnd ?? rangeStart))}
          className="text-sm px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function AnaliticaFilterBarInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const period = sp.get("period") ?? `month_${pad2(currentMonth)}`;
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
    router.replace(`${pathname}?${params.toString()}`);
  }

  function selectPeriod(newPeriod: string, newYear?: number) {
    update({ period: newPeriod, year: newYear ? String(newYear) : null, from: null, to: null });
    setOpen(false);
    setExpandedYear(null);
    setShowCustom(false);
  }

  function applyCustom(from: string, to: string) {
    update({ period: "custom", from, to, year: null });
    setOpen(false);
    setShowCustom(false);
  }

  function step(direction: 1 | -1) {
    if (period === "all") return;

    if (period === "custom" && customFrom && customTo) {
      const durationDays = Math.round((fromISO(customTo).getTime() - fromISO(customFrom).getTime()) / 86400000) + 1;
      update({
        from: shiftISODate(customFrom, direction * durationDays),
        to: shiftISODate(customTo, direction * durationDays),
      });
      return;
    }

    if (period === "year") {
      update({ year: String(year + direction) });
      return;
    }

    const qMatch = /^q([1-4])$/.exec(period);
    if (qMatch) {
      let q = parseInt(qMatch[1]) + direction;
      let y = year;
      if (q < 1) { q = 4; y -= 1; }
      if (q > 4) { q = 1; y += 1; }
      update({ period: `q${q}`, year: String(y) });
      return;
    }

    const mMatch = /^month_(\d{2})$/.exec(period);
    if (mMatch) {
      let m = parseInt(mMatch[1]) + direction;
      let y = year;
      if (m < 1) { m = 12; y -= 1; }
      if (m > 12) { m = 1; y += 1; }
      update({ period: `month_${pad2(m)}`, year: String(y) });
    }
  }

  const label = resolveCalendarPeriod({
    period,
    year: String(year),
    compareWith,
    from: customFrom,
    to: customTo,
  }).periodLabel;

  const disabled = period === "all";

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-navy/[0.06]">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={disabled}
          className="p-1.5 rounded-lg text-navy/40 hover:text-navy hover:bg-navy/[0.05] disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 bg-white border border-navy/[0.13] rounded-xl px-3 py-1.5 text-sm font-semibold text-navy shadow-sm outline-none cursor-pointer hover:border-navy/25 transition-colors"
          >
            <span>{label}</span>
            <ChevronDown size={12} className={`text-navy/35 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-navy/[0.12] rounded-xl shadow-lg overflow-hidden">
              <div className="flex">
                <ul className="py-1 min-w-[220px]">
                  {availableYears.map((y) => (
                    <li key={y}>
                      <button
                        type="button"
                        onClick={() => setExpandedYear(expandedYear === y ? null : y)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-sm transition-colors ${
                          expandedYear === y
                            ? "bg-primary/[0.06] text-primary font-medium"
                            : period !== "all" && period !== "custom" && year === y
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
                      className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                        showCustom || period === "custom"
                          ? "text-primary font-medium bg-primary/[0.06]"
                          : "text-navy/70 hover:bg-navy/[0.04] hover:text-navy"
                      }`}
                    >
                      <Calendar size={13} />
                      Buscar período personalizado
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => selectPeriod("all")}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        period === "all"
                          ? "text-primary font-medium bg-primary/[0.06]"
                          : "text-navy/70 hover:bg-navy/[0.04] hover:text-navy"
                      }`}
                    >
                      Desde el inicio
                    </button>
                  </li>
                </ul>

                {expandedYear && (
                  <ul className="py-1 min-w-[150px] border-l border-navy/[0.08] max-h-80 overflow-y-auto">
                    <li>
                      <button
                        type="button"
                        onClick={() => selectPeriod("year", expandedYear)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          period === "year" && year === expandedYear
                            ? "text-primary font-medium bg-primary/[0.06]"
                            : "text-navy/70 hover:bg-navy/[0.04] hover:text-navy"
                        }`}
                      >
                        Año completo
                      </button>
                    </li>
                    {QUARTER_VALUES.map((q, i) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => selectPeriod(q, expandedYear)}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            period === q && year === expandedYear
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
                            period === m.value && year === expandedYear
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

        <button
          type="button"
          onClick={() => step(1)}
          disabled={disabled}
          className="p-1.5 rounded-lg text-navy/40 hover:text-navy hover:bg-navy/[0.05] disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Compare with — disabled when period is "all" */}
      <div className={`flex items-center gap-2 sm:ml-auto ${disabled ? "opacity-35 pointer-events-none" : ""}`}>
        <span className="text-[11px] text-navy/40">Comparar con</span>
        <SelectPill value={compareWith} onChange={(v) => update({ compareWith: v })}>
          {COMPARE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </SelectPill>
      </div>
    </div>
  );
}

export default function AnaliticaFilterBar() {
  return (
    <Suspense fallback={<div className="h-10 mb-4" />}>
      <AnaliticaFilterBarInner />
    </Suspense>
  );
}
