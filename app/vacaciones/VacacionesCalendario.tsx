"use client";

import { useState, useEffect } from "react";

const PERSON_COLORS = [
  { dot: "bg-primary", stroke: "#4021c8", border: "border-primary/20", text: "text-primary", badge: "bg-primary/10 text-primary" },
  { dot: "bg-income",  stroke: "#298a83", border: "border-income/20",  text: "text-income",  badge: "bg-income/10 text-income" },
  { dot: "bg-warning", stroke: "#ff8a00", border: "border-warning/20", text: "text-warning", badge: "bg-warning/10 text-warning" },
];

const MONTH_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const TODAY = "2026-06-13";

type Persona = {
  nombre: string;
  inicioContrato: string;
  jornadaDias: number;
  diasTotales: number;
  vacaciones: string[];
};

// Group sorted date strings into consecutive ranges
function groupRanges(dates: string[]): { start: string; end: string; count: number }[] {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const ranges: { start: string; end: string; count: number }[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  let count = 1;

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const prevDate = new Date(prev + "T12:00:00");
    const curDate = new Date(cur + "T12:00:00");
    const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / 86400000);
    if (diffDays === 1) {
      count++;
    } else {
      ranges.push({ start, end: prev, count });
      start = cur;
      count = 1;
    }
    prev = cur;
  }
  ranges.push({ start, end: prev, count });
  return ranges;
}

function formatPeriod(start: string, end: string, count: number) {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const sm = MONTH_SHORT[s.getMonth()];
  const em = MONTH_SHORT[e.getMonth()];
  if (start === end) return { label: `${s.getDate()} ${sm}.`, days: `${count} día` };
  return {
    label: `${s.getDate()} ${sm}. → ${e.getDate()} ${em}.`,
    days: `${count} ${count === 1 ? "día" : "días"}`,
  };
}

// ── Sugerencias ───────────────────────────────────────────────────────────────

type Suggestion = {
  type: "success" | "warning" | "info";
  text: string;
};

function generateSuggestions(personas: Persona[], festivos: string[]): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const festivosSet = new Set(festivos);

  const vacByDate = new Map<string, number[]>();
  personas.forEach((p, i) => {
    p.vacaciones.forEach((d) => {
      if (!vacByDate.has(d)) vacByDate.set(d, []);
      vacByDate.get(d)!.push(i);
    });
  });

  const todayDate = new Date(TODAY + "T12:00:00");

  // 1. Días sin planificar
  personas.forEach((p) => {
    const remaining = p.diasTotales - p.vacaciones.length;
    if (p.vacaciones.length === 0) {
      suggestions.push({
        type: "warning",
        text: `${p.nombre} tiene ${p.diasTotales} días de vacaciones sin planificar aún.`,
      });
    } else if (remaining > 0) {
      suggestions.push({
        type: "info",
        text: `${p.nombre} tiene ${remaining} ${remaining === 1 ? "día pendiente" : "días pendientes"} de planificar.`,
      });
    }
  });

  // 2. Solapamientos: agrupar días consecutivos con 2+ personas
  const overlapDates = Array.from(vacByDate.entries())
    .filter(([, idxs]) => idxs.length >= 2)
    .map(([d]) => d)
    .sort();

  if (overlapDates.length > 0) {
    const ranges = groupRanges(overlapDates);
    ranges.forEach((r) => {
      const s = new Date(r.start + "T12:00:00");
      const e = new Date(r.end + "T12:00:00");
      const names = (vacByDate.get(r.start) ?? []).map((i) => personas[i].nombre);
      const period =
        r.start === r.end
          ? `el ${s.getDate()} de ${MONTH_NAMES[s.getMonth()].toLowerCase()}`
          : `entre el ${s.getDate()} y el ${e.getDate()} de ${MONTH_NAMES[s.getMonth()].toLowerCase()}`;
      suggestions.push({
        type: "warning",
        text: `Evita aprobar más ausencias ${period}: ${names.join(" y ")} ya ${names.length === 1 ? "está" : "están"} de vacaciones.`,
      });
    });
  }

  // 3. Ventanas libres próximas — por mes completo o quincena (máx 4)
  let freeWindows = 0;
  for (let mi = todayDate.getMonth(); mi < 12 && freeWindows < 4; mi++) {
    const month = mi + 1;
    const daysInMonth = new Date(2026, month, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    const prefix = `2026-${pad(month)}-`;

    const isHalfFree = (startDay: number, endDay: number) => {
      const halfStart = new Date(2026, mi, startDay);
      if (halfStart <= todayDate) return false;
      const workDays = Array.from({ length: endDay - startDay + 1 }, (_, i) => {
        const ds = `${prefix}${pad(startDay + i)}`;
        const jsDay = new Date(ds + "T12:00:00").getDay();
        return { ds, isWeekend: jsDay === 0 || jsDay === 6 };
      }).filter(({ isWeekend, ds }) => !isWeekend && !festivosSet.has(ds));
      return workDays.length >= 3 && workDays.every(({ ds }) => !vacByDate.has(ds));
    };

    const firstFree = isHalfFree(1, 15);
    const secondFree = isHalfFree(16, daysInMonth);
    const monthName = MONTH_NAMES[mi].toLowerCase();

    if (firstFree && secondFree) {
      suggestions.push({ type: "success", text: `${MONTH_NAMES[mi]} tiene disponibilidad completa.` });
      freeWindows++;
    } else if (firstFree) {
      suggestions.push({ type: "success", text: `Primera quincena de ${monthName} libre.` });
      freeWindows++;
    } else if (secondFree) {
      suggestions.push({ type: "success", text: `Segunda quincena de ${monthName} libre.` });
      freeWindows++;
    }
  }

  return suggestions;
}

function SugerenciasBlock({ personas, festivos }: { personas: Persona[]; festivos: string[] }) {
  const suggestions = generateSuggestions(personas, festivos);
  if (suggestions.length === 0) return null;

  const icon = { success: "✅", warning: "⚠️", info: "ℹ️" };
  const styles = {
    success: "bg-success/8 text-success border border-success/20",
    warning: "bg-warning/8 text-warning border border-warning/20",
    info: "bg-navy/5 text-navy/60 border border-navy/10",
  };

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((s, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs leading-snug ${styles[s.type]}`}
        >
          <span className="shrink-0">{icon[s.type]}</span>
          {s.text}
        </span>
      ))}
    </div>
  );
}

const ABSENCE_TYPES = [
  { key: "vacaciones", label: "Vacaciones", color: "bg-warning" },
  { key: "enfermedad", label: "Bajas por enfermedad", color: "bg-navy/30" },
  { key: "familiar", label: "Enfermedad de familiar", color: "bg-warning/60" },
  { key: "otros", label: "Otros permisos", color: "bg-primary/40" },
];

function AusenciasModal({ persona, idx, onClose }: { persona: Persona; idx: number; onClose: () => void }) {
  const colors = PERSON_COLORS[idx];
  const vacUsadas = persona.vacaciones.length;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-navy/10">
          <div>
            <p className="font-semibold text-navy">Resumen de ausencias</p>
            <p className="text-xs text-navy/55 mt-0.5">{persona.nombre} · 2026</p>
          </div>
          <button onClick={onClose} className="text-navy/45 hover:text-navy text-xl leading-none">×</button>
        </div>

        {/* Rows */}
        <div className="px-6 py-4 space-y-4">
          {/* Vacaciones — tenemos datos reales */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className="text-sm font-medium text-navy">Vacaciones</span>
              </div>
              <span className="text-sm font-medium text-navy tabular-nums">
                {vacUsadas} / {persona.diasTotales} días
              </span>
            </div>
            <div className="ml-4 mt-1.5 space-y-1">
              <div className="flex justify-between text-xs text-navy/55">
                <span>Según convenio (proporcional)</span>
                <span>{persona.diasTotales} días</span>
              </div>
              <div className="flex justify-between text-xs text-navy/55">
                <span>Planificados</span>
                <span>{vacUsadas} días</span>
              </div>
              <div className="flex justify-between text-xs text-navy/55">
                <span>Restantes</span>
                <span>{persona.diasTotales - vacUsadas} días</span>
              </div>
            </div>
          </div>

          <div className="border-t border-navy/5" />

          {/* Otros tipos — sin datos */}
          {ABSENCE_TYPES.slice(1).map((t) => (
            <div key={t.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${t.color}`} />
                <span className="text-sm text-navy/60">{t.label}</span>
              </div>
              <span className="text-xs bg-navy/5 text-navy/55 px-2 py-0.5 rounded">sin datos</span>
            </div>
          ))}
        </div>

        <div className="px-6 pb-5">
          <p className="text-[10px] text-navy/45">
            Los tipos de ausencia distintos a vacaciones no están disponibles a través de la API de Momence.
          </p>
        </div>
      </div>
    </div>
  );
}

// SVG donut
function Donut({ used, total, stroke }: { used: number; total: number; stroke: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? used / total : 0;
  const dash = pct * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
      <circle
        cx="36" cy="36" r={r} fill="none"
        stroke={stroke} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
    </svg>
  );
}

// Date badge (like "15 / JUN")
function DateBadge({ dateStr }: { dateStr: string }) {
  const d = new Date(dateStr + "T12:00:00");
  return (
    <div className="w-12 shrink-0 bg-navy/5 rounded text-center py-1.5">
      <p className="text-sm font-semibold text-navy leading-tight">{d.getDate()}</p>
      <p className="text-[10px] text-navy/50 uppercase">{MONTH_SHORT[d.getMonth()]}</p>
    </div>
  );
}

function PersonCard({ persona, idx }: { persona: Persona; idx: number }) {
  const [showModal, setShowModal] = useState(false);
  const colors = PERSON_COLORS[idx];
  const used = persona.vacaciones.length;
  const remaining = persona.diasTotales - used;

  const ranges = groupRanges(persona.vacaciones);
  const upcoming = ranges.filter((r) => r.end >= TODAY);
  const past = ranges.filter((r) => r.end < TODAY);

  return (
    <>
    {showModal && <AusenciasModal persona={persona} idx={idx} onClose={() => setShowModal(false)} />}
    <div className={`bg-white border ${colors.border} rounded shadow-card overflow-hidden`}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-navy/5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-navy">{persona.nombre}</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-xs text-primary/60 hover:text-primary transition-colors"
          >
            Ver ausencias
          </button>
        </div>

        {/* Donut + stats */}
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <Donut used={used} total={persona.diasTotales} stroke={colors.stroke} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-sm font-semibold text-navy leading-tight">{used}</p>
              <p className="text-[9px] text-navy/55 leading-tight">de {persona.diasTotales}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <p className="text-xs text-navy/50">Planificados</p>
              </div>
              <p className="text-2xl font-semibold text-navy">{used}</p>
            </div>
            <div className="w-px bg-navy/10 self-stretch" />
            <div>
              <p className="text-xs text-navy/55 mb-0.5">Restantes</p>
              <p className="text-2xl font-semibold text-navy/55">{remaining}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Absence list */}
      <div className="px-5 py-4 space-y-4">
        {used === 0 && (
          <p className="text-xs text-warning">Sin días planificados aún</p>
        )}

        {upcoming.length > 0 && (
          <div>
            <p className="text-xs font-medium text-navy/55 mb-2">
              Próximas ausencias ({upcoming.length})
            </p>
            <div className="space-y-2">
              {upcoming.map((r) => {
                const { label, days } = formatPeriod(r.start, r.end, r.count);
                return (
                  <div key={r.start} className="flex items-center gap-3">
                    <DateBadge dateStr={r.start} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                        <p className="text-sm font-medium text-navy">Vacaciones</p>
                      </div>
                      <p className="text-xs text-navy/55">{label} ({days})</p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                      <span className="text-success text-xs">✓</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <p className="text-xs font-medium text-navy/55 mb-2">
              Ausencias anteriores ({past.length})
            </p>
            <div className="space-y-2">
              {past.map((r) => {
                const { label, days } = formatPeriod(r.start, r.end, r.count);
                return (
                  <div key={r.start} className="flex items-center gap-3">
                    <DateBadge dateStr={r.start} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-navy/20" />
                        <p className="text-sm text-navy/50">Vacaciones</p>
                      </div>
                      <p className="text-xs text-navy/45">{label} ({days})</p>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-navy/5 flex items-center justify-center shrink-0">
                      <span className="text-navy/45 text-xs">✓</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

// Compact overlap calendar (only months with overlaps)
function OverlapCalendar({ personas }: { personas: Persona[] }) {
  const vacByDate = new Map<string, number[]>();
  personas.forEach((p, i) => {
    p.vacaciones.forEach((d) => {
      if (!vacByDate.has(d)) vacByDate.set(d, []);
      vacByDate.get(d)!.push(i);
    });
  });

  const overlaps = Array.from(vacByDate.entries())
    .filter(([, idxs]) => idxs.length >= 2)
    .sort(([a], [b]) => a.localeCompare(b));

  if (overlaps.length === 0) return null;

  const DAY_NAMES = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"];
  function fmtDate(ds: string) {
    const d = new Date(ds + "T12:00:00");
    return `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
  }

  return (
    <div className="bg-danger/5 border border-danger/20 rounded p-5">
      <p className="text-xs font-semibold text-danger uppercase tracking-wider mb-4">
        ⚠ {overlaps.length} {overlaps.length === 1 ? "solapamiento detectado" : "solapamientos detectados"}
      </p>
      <div className="space-y-2">
        {overlaps.map(([dateStr, idxs]) => (
          <div key={dateStr} className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-navy/60 w-56 shrink-0">{fmtDate(dateStr)}</span>
            <div className="flex gap-1.5">
              {idxs.map((i) => (
                <span key={i} className={`text-xs px-2 py-0.5 rounded ${PERSON_COLORS[i].badge}`}>
                  {personas[i].nombre}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  return { daysInMonth, startOffset };
}

function AnnualCalendar({
  personas,
  allPersonas,
  festivos,
}: {
  personas: Persona[];
  allPersonas: Persona[];
  festivos: string[];
}) {
  const festivosSet = new Set(festivos);
  const vacByDate = new Map<string, number[]>();
  personas.forEach((p) => {
    const i = allPersonas.findIndex((orig) => orig.nombre === p.nombre);
    p.vacaciones.forEach((d) => {
      if (!vacByDate.has(d)) vacByDate.set(d, []);
      vacByDate.get(d)!.push(i);
    });
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {MONTH_NAMES.map((monthName, mi) => {
        const month = mi + 1;
        const { daysInMonth, startOffset } = buildCalendar(2026, month);
        const cells = Array.from({ length: startOffset + daysInMonth }, (_, idx) => {
          if (idx < startOffset) return null;
          const day = idx - startOffset + 1;
          const dateStr = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isFestivo = festivosSet.has(dateStr);
          const personasVac = vacByDate.get(dateStr) ?? [];
          const isSolapamiento = personasVac.length >= 2;
          const isToday = dateStr === TODAY;
          return { day, dateStr, isFestivo, personasVac, isSolapamiento, isToday };
        });

        const monthVac = personas.map((p) => {
          const i = allPersonas.findIndex((orig) => orig.nombre === p.nombre);
          return {
            name: p.nombre,
            days: p.vacaciones
              .filter((d) => d.startsWith(`2026-${String(month).padStart(2, "0")}-`))
              .map((d) => parseInt(d.split("-")[2])),
            colors: PERSON_COLORS[i],
          };
        }).filter((p) => p.days.length > 0);

        return (
          <div key={month} className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-semibold text-navy/50 uppercase tracking-wider">{monthName}</p>
            </div>
            <div className="grid grid-cols-7 px-3 pb-1">
              {["L","M","X","J","V","S","D"].map((d) => (
                <div key={d} className="text-center text-[10px] text-navy/45 font-medium py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
              {cells.map((cell, idx) => {
                if (!cell) return <div key={`e-${idx}`} />;
                const { day, dateStr, isFestivo, personasVac, isSolapamiento, isToday } = cell;
                const isWeekend = (idx % 7) >= 5;
                return (
                  <div
                    key={dateStr}
                    className={`flex flex-col items-center py-1 rounded ${
                      isSolapamiento
                        ? "bg-danger/20 ring-1 ring-danger/30"
                        : isFestivo
                        ? "bg-danger/10"
                        : isToday
                        ? "bg-primary/10"
                        : ""
                    }`}
                  >
                    <span className={`text-xs tabular-nums leading-tight ${
                      isToday
                        ? "text-primary font-semibold"
                        : isSolapamiento
                        ? "text-danger font-semibold"
                        : isFestivo
                        ? "text-danger font-medium"
                        : isWeekend
                        ? "text-navy/55"
                        : "text-navy/70"
                    }`}>
                      {day}
                    </span>
                    {personasVac.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                        {personasVac.map((pi) => (
                          <div key={pi} className={`w-1.5 h-1.5 rounded-full ${PERSON_COLORS[pi].dot}`} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {monthVac.length > 0 && (
              <div className="border-t border-navy/5 px-4 py-2 space-y-1">
                {monthVac.map((p) => (
                  <div key={p.name} className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.colors.dot}`} />
                    <span className="text-[10px] text-navy/50">
                      {p.name}: días {p.days.join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GanttView({
  personas,
  allPersonas,
  festivos,
}: {
  personas: Persona[];
  allPersonas: Persona[];
  festivos: string[];
}) {
  const festivosSet = new Set(festivos);

  // Build overlap map across all persons
  const vacByDate = new Map<string, number[]>();
  allPersonas.forEach((p, i) => {
    p.vacaciones.forEach((d) => {
      if (!vacByDate.has(d)) vacByDate.set(d, []);
      vacByDate.get(d)!.push(i);
    });
  });

  const months = Array.from({ length: 12 }, (_, mi) => {
    const month = mi + 1;
    const daysInMonth = new Date(2026, month, 0).getDate();
    // count working days (Mon-Fri, non-festivo) for denominator
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `2026-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const jsDay = new Date(ds + "T12:00:00").getDay();
      if (jsDay !== 0 && jsDay !== 6 && !festivosSet.has(ds)) workingDays++;
    }
    // today position within this month (0-1), or null
    const isCurrentMonth = TODAY.startsWith(`2026-${String(month).padStart(2, "0")}-`);
    return { month, name: MONTH_SHORT[mi], daysInMonth, workingDays, isCurrentMonth };
  });

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
      {/* Month header row */}
      <div className="flex mb-3">
        <div className="w-24 shrink-0" />
        <div className="flex-1 grid grid-cols-12 gap-1">
          {months.map((m) => (
            <div
              key={m.month}
              className={`text-center text-[10px] font-medium pb-2 border-b ${
                m.isCurrentMonth ? "text-primary border-primary" : "text-navy/55 border-navy/10"
              }`}
            >
              {m.name}
            </div>
          ))}
        </div>
      </div>

      {/* Person rows */}
      <div className="space-y-2">
        {personas.map((p) => {
          const i = allPersonas.findIndex((orig) => orig.nombre === p.nombre);
          const colors = PERSON_COLORS[i];

          return (
            <div key={p.nombre} className="flex items-center">
              <span className="w-24 shrink-0 text-xs text-navy/60 pr-3 truncate">{p.nombre}</span>
              <div className="flex-1 grid grid-cols-12 gap-1">
                {months.map((m) => {
                  // Count vac days and overlap days in this month
                  const prefix = `2026-${String(m.month).padStart(2, "0")}-`;
                  const vacDays = p.vacaciones.filter((d) => d.startsWith(prefix));
                  const overlapDays = vacDays.filter(
                    (d) => (vacByDate.get(d)?.length ?? 0) >= 2
                  );
                  const fillPct = m.workingDays > 0 ? (vacDays.length / m.workingDays) * 100 : 0;
                  const hasOverlap = overlapDays.length > 0;
                  const tooltip = vacDays.length > 0
                    ? `${p.nombre} · ${vacDays.map((d) => parseInt(d.split("-")[2])).join(", ")} ${MONTH_SHORT[m.month - 1]}`
                    : "";

                  return (
                    <div
                      key={m.month}
                      className="relative h-9 bg-navy/[0.04] rounded overflow-hidden"
                      title={tooltip}
                    >
                      {/* Fill bar */}
                      {fillPct > 0 && (
                        <div
                          className={`absolute inset-y-1 left-1 rounded ${
                            hasOverlap ? "bg-danger/60" : colors.dot + " opacity-75"
                          }`}
                          style={{ width: `calc(${fillPct}% - 4px)`, minWidth: "6px" }}
                        />
                      )}
                      {/* Day count badge */}
                      {vacDays.length > 0 && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white mix-blend-multiply opacity-0 hover:opacity-100 transition-opacity">
                          {vacDays.length}d
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Festivos row */}
      <div className="flex items-center mt-3 pt-3 border-t border-navy/5">
        <span className="w-24 shrink-0 text-[10px] text-navy/45 pr-3">Festivos</span>
        <div className="flex-1 grid grid-cols-12 gap-1">
          {months.map((m) => {
            const prefix = `2026-${String(m.month).padStart(2, "0")}-`;
            const count = festivos.filter((d) => d.startsWith(prefix)).length;
            return (
              <div key={m.month} className="relative h-4 bg-navy/[0.03] rounded overflow-hidden">
                {count > 0 && (
                  <div className="absolute inset-y-0.5 left-0.5 right-0.5 rounded bg-danger/25 flex items-center justify-center">
                    <span className="text-[9px] text-danger/70 font-medium">{count}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-navy/5">
        {personas.map((p) => {
          const i = allPersonas.findIndex((orig) => orig.nombre === p.nombre);
          return (
            <div key={p.nombre} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${PERSON_COLORS[i].dot} opacity-75`} />
              <span className="text-[10px] text-navy/50">{p.nombre}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-danger/60" />
          <span className="text-[10px] text-navy/50">Solapamiento</span>
        </div>
      </div>
    </div>
  );
}

export default function VacacionesCalendario({
  personas,
  festivos,
}: {
  personas: Persona[];
  festivos: string[];
}) {
  const [filtro, setFiltro] = useState<string>("todas");

  const personasFiltradas = filtro === "todas"
    ? personas
    : personas.filter((p) => p.nombre === filtro);

  return (
    <div className="space-y-8">
      {/* Filtro */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-navy/55">Ver:</span>
        <div className="flex rounded overflow-hidden border border-navy/10 text-sm">
          {[{ key: "todas", label: "Todas" }, ...personas.map((p) => ({ key: p.nombre, label: p.nombre }))].map(
            ({ key, label }) => (
              <button
                key={key}
                onClick={() => setFiltro(key)}
                className={`px-3 py-1.5 transition-colors ${
                  filtro === key ? "bg-navy text-white" : "bg-white text-navy/50 hover:text-navy"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* Sugerencias (siempre sobre todos los datos) */}
      <section>
        <h2 className="text-xs font-semibold text-navy/55 uppercase tracking-widest mb-3">
          Sugerencias
        </h2>
        <SugerenciasBlock personas={personas} festivos={festivos} />
      </section>

      {/* Alertas de solapamiento (solo en vista "todas") */}
      {filtro === "todas" && (
        <OverlapCalendar personas={personas} />
      )}

      {/* Tarjetas por persona */}
      <div className={`grid gap-5 ${personasFiltradas.length === 1 ? "max-w-sm" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {personasFiltradas.map((p) => {
          const i = personas.findIndex((orig) => orig.nombre === p.nombre);
          return <PersonCard key={p.nombre} persona={p} idx={i} />;
        })}
      </div>

      {/* Vista Gantt */}
      <section>
        <h2 className="text-xs font-semibold text-navy/55 uppercase tracking-widest mb-4">
          Vista anual
        </h2>
        <GanttView personas={personasFiltradas} allPersonas={personas} festivos={festivos} />
      </section>

      {/* Calendario mensual */}
      <section>
        <h2 className="text-xs font-semibold text-navy/55 uppercase tracking-widest mb-4">
          Calendario 2026
        </h2>
        <AnnualCalendar personas={personasFiltradas} allPersonas={personas} festivos={festivos} />
      </section>

      <p className="text-[10px] text-navy/45">
        Convenio: 23 días laborales por año completo a jornada de 5 días/semana. Días proporcionales a jornada y fecha de inicio de contrato.
      </p>
    </div>
  );
}
