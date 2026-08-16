"use client";

import { useState, useEffect, useCallback } from "react";
import Drawer from "@/app/components/Drawer";
import Button, { SecondaryButton } from "@/app/components/Button";
import { PrimaryButtonV2, IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import HeaderPortal from "@/app/components/HeaderPortal";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import { ToggleGroup } from "@/components/charts";
import { useRouter } from "next/navigation";
import {
  addAusenciasAction,
  removeAusenciasAction,
  createPersonaAction,
  updatePersonaDiasExtraAction,
  archivePersonaAction,
  unarchivePersonaAction,
  deletePersonaAction,
  loadArchivedPersonasAction,
} from "@/app/actions/vacaciones";

const PERSON_COLORS = [
  { dot: "bg-primary", cellBg: "bg-primary/[0.12]", stroke: "#4021c8", border: "border-primary/20", text: "text-primary", badge: "bg-primary/10 text-primary" },
  { dot: "bg-income",  cellBg: "bg-income/[0.12]",  stroke: "#298a83", border: "border-income/20",  text: "text-income",  badge: "bg-income/10 text-income" },
  { dot: "bg-warning", cellBg: "bg-warning/[0.12]", stroke: "#ff8a00", border: "border-warning/20", text: "text-warning", badge: "bg-warning/10 text-warning" },
  { dot: "bg-purple-500", cellBg: "bg-purple-500/[0.12]", stroke: "#8b5cf6", border: "border-purple-200 dark:border-purple-500/30", text: "text-purple-600 dark:text-purple-400", badge: "bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  { dot: "bg-pink-500", cellBg: "bg-pink-500/[0.12]", stroke: "#ec4899", border: "border-pink-200 dark:border-pink-500/30", text: "text-pink-600 dark:text-pink-400", badge: "bg-pink-50 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400" },
];

const MONTH_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const TODAY = new Date().toISOString().split("T")[0];
const YEAR = new Date().getFullYear();

type AbsenceKey = "vacaciones" | "enfermedad" | "familiar" | "otros";

type Persona = {
  id: string;
  nombre: string;
  inicioContrato: string;
  jornadaDias: number;
  diasTotales: number;
  diasExtra: number;
  vacaciones: string[];
  enfermedad: string[];
  familiar: string[];
  otros: string[];
};

const ABSENCE_TYPES: { key: AbsenceKey; label: string; dotHex: string }[] = [
  { key: "vacaciones",  label: "Vacaciones",              dotHex: "#4021c8" },
  { key: "enfermedad",  label: "Bajas por enfermedad",    dotHex: "#94a3b8" },
  { key: "familiar",    label: "Enfermedad de familiar",  dotHex: "#f59e0b" },
  { key: "otros",       label: "Otros permisos",          dotHex: "#8b5cf6" },
];

function getAbsenceDates(p: Persona, key: AbsenceKey): string[] {
  return p[key] ?? [];
}

/** Ausencias de un año concreto (el actual por defecto). loadPersonas() trae TODAS las
 * ausencias de TODOS los años sin filtrar - el presupuesto de vacaciones es un cupo anual, así
 * que "usado"/"restantes" debe contar solo lo de este año, no el histórico completo (que sí se
 * sigue mostrando entero en "Ausencias anteriores", eso es información, no consumo del cupo). */
function inYear(dates: string[], year: number = YEAR): string[] {
  const prefix = `${year}-`;
  return dates.filter((d) => d.startsWith(prefix));
}

// dias_totales se calcula una sola vez, al dar de alta (prorrateado según lo que queda del año
// de contratación) - nunca se vuelve a recalcular, así que a partir del año siguiente ya no
// representa un año completo. Desde el año siguiente al de alta se usa el cupo completo del
// convenio (23 días laborables × jornada, misma fórmula que calcVacaciones) en su lugar.
function baseAnualVacaciones(p: Persona): number {
  const hireYear = parseInt(p.inicioContrato.slice(0, 4), 10) || YEAR;
  return YEAR > hireYear ? Math.round(23 * (p.jornadaDias / 5)) : p.diasTotales;
}

// Total efectivo de vacaciones para el año en curso = cupo base del año (ver arriba) + días
// extra concedidos.
function totalVacaciones(p: Persona): number {
  return baseAnualVacaciones(p) + p.diasExtra;
}

function groupRanges(dates: string[]): { start: string; end: string; count: number }[] {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const ranges: { start: string; end: string; count: number }[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  let count = 1;

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const diffDays = Math.round(
      (new Date(cur + "T12:00:00").getTime() - new Date(prev + "T12:00:00").getTime()) / 86400000
    );
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

type Suggestion = { type: "success" | "warning" | "info"; text: string };

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

  personas.forEach((p) => {
    const remaining = totalVacaciones(p) - inYear(p.vacaciones).length;
    if (inYear(p.vacaciones).length === 0) {
      suggestions.push({ type: "warning", text: `${p.nombre} tiene ${totalVacaciones(p)} días de vacaciones sin planificar aún.` });
    } else if (remaining > 0) {
      suggestions.push({ type: "info", text: `${p.nombre} tiene ${remaining} ${remaining === 1 ? "día pendiente" : "días pendientes"} de planificar.` });
    }
  });

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
          : s.getMonth() === e.getMonth()
          ? `entre el ${s.getDate()} y el ${e.getDate()} de ${MONTH_NAMES[s.getMonth()].toLowerCase()}`
          : `entre el ${s.getDate()} de ${MONTH_NAMES[s.getMonth()].toLowerCase()} y el ${e.getDate()} de ${MONTH_NAMES[e.getMonth()].toLowerCase()}`;
      suggestions.push({ type: "warning", text: `Evita aprobar más ausencias ${period}: ${names.join(" y ")} ya ${names.length === 1 ? "está" : "están"} de vacaciones.` });
    });
  }

  const fullMonths: string[] = [];
  const firstHalfMonths: string[] = [];
  const secondHalfMonths: string[] = [];

  let freeWindows = 0;
  for (let mi = todayDate.getMonth(); mi < 12 && freeWindows < 4; mi++) {
    const month = mi + 1;
    const daysInMonth = new Date(YEAR, month, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    const prefix = `${YEAR}-${pad(month)}-`;

    const isHalfFree = (startDay: number, endDay: number) => {
      const halfStart = new Date(YEAR, mi, startDay);
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

    if (firstFree && secondFree) {
      fullMonths.push(MONTH_NAMES[mi]);
      freeWindows++;
    } else if (firstFree) {
      firstHalfMonths.push(MONTH_NAMES[mi].toLowerCase());
      freeWindows++;
    } else if (secondFree) {
      secondHalfMonths.push(MONTH_NAMES[mi].toLowerCase());
      freeWindows++;
    }
  }

  const joinWithY = (items: string[]) =>
    items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;

  if (fullMonths.length > 0) {
    suggestions.push({ type: "success", text: `Meses con disponibilidad completa: ${joinWithY(fullMonths)}.` });
  }
  if (firstHalfMonths.length > 0) {
    suggestions.push({ type: "success", text: `Primera quincena libre en: ${joinWithY(firstHalfMonths)}.` });
  }
  if (secondHalfMonths.length > 0) {
    suggestions.push({ type: "success", text: `Segunda quincena libre en: ${joinWithY(secondHalfMonths)}.` });
  }

  return suggestions;
}

function SugerenciasBlock({ personas, festivos }: { personas: Persona[]; festivos: string[] }) {
  const suggestions = generateSuggestions(personas, festivos);
  if (suggestions.length === 0) return null;

  const dot = {
    success: "bg-success",
    warning: "bg-warning",
    info: "bg-navy/30",
  };
  const text = {
    success: "text-navy/70",
    warning: "text-warning",
    info: "text-navy/55",
  };

  return (
    <div className="bg-card border border-border rounded-[14px] divide-y divide-navy/[0.06]">
      {suggestions.map((s, i) => (
        <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
          <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${dot[s.type]}`} />
          <span className={`text-xs leading-relaxed ${text[s.type]}`}>{s.text}</span>
        </div>
      ))}
    </div>
  );
}

// ── Cálculo de vacaciones según ET art. 38 ───────────────────────────────────
// 23 días laborables/año para jornada completa (5d/sem, por convenio - el mínimo legal son 22),
// prorrateados por:
//   - fracción de jornada (jornadaDias/5)
//   - días restantes del año desde la fecha de inicio

function calcVacaciones(startDate: string, jornadaDias: number): { dias: number; hint: string } {
  if (!startDate) return { dias: 0, hint: "" };
  const start  = new Date(startDate + "T12:00:00");
  const year   = start.getFullYear();
  const yearEnd = new Date(year, 11, 31, 12, 0, 0);
  const totalDays    = 365 + (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 1 : 0);
  const remainingDays = Math.round((yearEnd.getTime() - start.getTime()) / 86400000) + 1;
  const baseAnual = Math.round(23 * (jornadaDias / 5));
  const dias = Math.max(0, Math.round((remainingDays / totalDays) * baseAnual));
  const hint = `${baseAnual} días/año × ${remainingDays}/${totalDays} días = ${dias} días`;
  return { dias, hint };
}

// ── Nuevo instructor modal ────────────────────────────────────────────────────

function NuevoInstructorModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: { nombre: string; inicio_contrato: string; jornada_dias: number; dias_totales: number }) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [inicioContrato, setInicioContrato] = useState(TODAY);
  const [jornadaDias, setJornadaDias] = useState(5);
  const [saving, setSaving] = useState(false);

  const { dias: diasAuto, hint } = calcVacaciones(inicioContrato, jornadaDias);
  const [diasTotales, setDiasTotales] = useState(diasAuto);
  const [userEdited, setUserEdited] = useState(false);

  function handleJornada(v: number) {
    setJornadaDias(v);
    if (!userEdited) setDiasTotales(calcVacaciones(inicioContrato, v).dias);
  }
  function handleInicio(v: string) {
    setInicioContrato(v);
    if (!userEdited) setDiasTotales(calcVacaciones(v, jornadaDias).dias);
  }
  function handleDias(v: number) {
    setDiasTotales(v);
    setUserEdited(true);
  }

  async function handleSubmit(close: () => void) {
    if (!nombre.trim()) return;
    setSaving(true);
    await onCreate({ nombre: nombre.trim(), inicio_contrato: inicioContrato, jornada_dias: jornadaDias, dias_totales: diasTotales });
    setSaving(false);
    close();
  }

  return (
    <Drawer
      title="Nuevo instructor"
      onClose={onClose}
      maxWidth="max-w-sm"
      footer={(close) => (
        <div className="flex gap-3">
          <SecondaryButton onClick={close} className="flex-1">
            Cancelar
          </SecondaryButton>
          <Button onClick={() => handleSubmit(close)} disabled={!nombre.trim() || saving} className="flex-1">
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      )}
    >
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="block text-xs text-navy/55 mb-1.5">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del instructor"
            autoFocus
            className="w-full text-sm border border-navy/[0.12] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
          />
        </div>
        <div>
          <label className="block text-xs text-navy/55 mb-1.5">Inicio de contrato</label>
          <input
            type="date"
            value={inicioContrato}
            onChange={(e) => handleInicio(e.target.value)}
            className="w-full text-sm border border-navy/[0.12] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-navy/55 mb-1.5">Días jornada/sem.</label>
            <input
              type="number" min={1} max={7} value={jornadaDias}
              onChange={(e) => handleJornada(Number(e.target.value))}
              className="w-full text-sm border border-navy/[0.12] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
            />
          </div>
          <div>
            <label className="block text-xs text-navy/55 mb-1.5">
              Días vacaciones
              {!userEdited && <span className="ml-1 text-[10px] text-primary/70 font-normal">· calculado</span>}
            </label>
            <input
              type="number" min={0} max={365} value={diasTotales}
              onChange={(e) => handleDias(Number(e.target.value))}
              className="w-full text-sm border border-navy/[0.12] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
            />
          </div>
        </div>
        {hint && (
          <p className="text-[11px] text-navy/40 leading-relaxed">
            ET art. 38 · {hint}
            {userEdited && (
              <button type="button" onClick={() => { setDiasTotales(diasAuto); setUserEdited(false); }}
                className="ml-2 text-primary/70 hover:text-primary underline underline-offset-2 transition-colors">
                restablecer
              </button>
            )}
          </p>
        )}
      </div>
    </Drawer>
  );
}

// ── Añadir ausencia modal ─────────────────────────────────────────────────────

type DurationType = "day" | "range";

function getDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from + "T12:00:00");
  const end = new Date(to + "T12:00:00");
  if (end < start) return [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

/** ¿Es un día laborable (ni sábado/domingo ni festivo)? El presupuesto de vacaciones se cuenta
 * en días laborables (art. 38 ET, "23 días laborables/año"), así que un rango de vacaciones no
 * debe arrastrar los findes/festivos que caen dentro como si fueran días consumidos - una
 * quincena de vacaciones tiene ~10 días laborables, no 14. */
function isWorkingDay(dateStr: string, festivosSet: Set<string>): boolean {
  const jsDay = new Date(dateStr + "T12:00:00").getDay();
  if (jsDay === 0 || jsDay === 6) return false;
  return !festivosSet.has(dateStr);
}

function fmtPreviewDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()].toLowerCase()}`;
}

function AñadirAusenciaModal({
  persona,
  festivos,
  onClose,
  onAdd,
}: {
  persona: Persona;
  festivos: string[];
  onClose: () => void;
  onAdd: (typeKey: AbsenceKey, dates: string[]) => Promise<void>;
}) {
  const [absenceType, setAbsenceType] = useState<AbsenceKey>("vacaciones");
  const [duration, setDuration] = useState<DurationType>("day");
  const [dateFrom, setDateFrom] = useState(TODAY);
  const [dateTo, setDateTo] = useState(TODAY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingDates = getAbsenceDates(persona, absenceType);
  const isVacaciones = absenceType === "vacaciones";

  // En un rango de vacaciones se excluyen findes y festivos (ver isWorkingDay) - un solo día
  // elegido a mano sí se respeta tal cual, por si de verdad hace falta marcar justo ese día.
  const rangeDates = duration === "day" ? [dateFrom] : getDatesInRange(dateFrom, dateTo);
  const festivosSet = new Set(festivos);
  const candidateDates = isVacaciones && duration === "range"
    ? rangeDates.filter((d) => isWorkingDay(d, festivosSet))
    : rangeDates;
  const excludedCount = rangeDates.length - candidateDates.length;
  const newDates = candidateDates.filter((d) => !existingDates.includes(d));

  const alreadyExists = duration === "day" && existingDates.includes(dateFrom);
  const selectedType = ABSENCE_TYPES.find((t) => t.key === absenceType)!;

  async function handleSolicitar(close: () => void) {
    if (newDates.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd(absenceType, newDates);
      close();
    } catch (err) {
      console.error("Error al guardar ausencia:", err);
      setError("Error al guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const previewLabel = duration === "day"
    ? fmtPreviewDate(dateFrom)
    : newDates.length > 0
    ? `${fmtPreviewDate(dateFrom)} → ${fmtPreviewDate(dateTo)}`
    : "-";

  const vacUsadas = inYear(persona.vacaciones).length;

  return (
    <Drawer
      title="Solicitar ausencia"
      subtitle={persona.nombre}
      onClose={onClose}
      maxWidth="max-w-xl"
      footer={(close) => (
        <div className="flex gap-3">
          <SecondaryButton onClick={close} className="flex-1">
            Cancelar
          </SecondaryButton>
          <Button onClick={() => handleSolicitar(close)} disabled={newDates.length === 0 || saving} className="flex-1">
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      )}
    >
        <div className="flex flex-col sm:flex-row">
          <div className="flex-1 px-6 py-5 space-y-5">
            {/* Type selector */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy/45">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div className="flex-1 relative">
                <div className="flex items-center gap-2 border border-navy/[0.12] rounded-lg px-3 py-2.5 bg-card pointer-events-none absolute inset-0 z-10">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedType.dotHex }} />
                  <span className="text-sm text-navy flex-1 truncate">{selectedType.label}</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy/35 shrink-0">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
                <select
                  value={absenceType}
                  onChange={(e) => setAbsenceType(e.target.value as AbsenceKey)}
                  className="relative z-20 w-full opacity-0 py-2.5 cursor-pointer text-sm"
                >
                  {ABSENCE_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Duration toggle */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy/45">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <ToggleGroup
                options={[
                  { value: "day", label: "Un día", activeClassName: "bg-primary text-white font-medium" },
                  { value: "range", label: "Varios días", activeClassName: "bg-primary text-white font-medium" },
                ]}
                value={duration}
                onChange={(v) => setDuration(v as DurationType)}
                fullWidth
                className="flex-1"
              />
            </div>

            {/* Date input(s) */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 flex items-center justify-center mt-2 shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy/45">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  {duration === "range" && (
                    <p className="text-[11px] text-navy/45 uppercase tracking-wide mb-1">Desde</p>
                  )}
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      if (duration === "range" && e.target.value > dateTo) setDateTo(e.target.value);
                    }}
                    className="w-full text-sm border border-navy/[0.12] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
                  />
                </div>
                {duration === "range" && (
                  <div>
                    <p className="text-[11px] text-navy/45 uppercase tracking-wide mb-1">Hasta</p>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full text-sm border border-navy/[0.12] rounded-lg px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
                    />
                  </div>
                )}
              </div>
            </div>

            {alreadyExists && (
              <p className="text-xs text-warning ml-11">Este día ya está registrado.</p>
            )}
            {error && (
              <p className="text-xs text-danger ml-11">{error}</p>
            )}
          </div>

          {/* Right: preview */}
          <div className="sm:w-52 bg-navy/[0.02] border-t sm:border-t-0 sm:border-l border-navy/[0.07] px-5 py-5 flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedType.dotHex }} />
                <p className="text-sm font-semibold text-navy">{selectedType.label}</p>
              </div>
              <p className="text-sm text-navy/70">{previewLabel}</p>
              <p className="text-xs text-navy/50 mt-1">
                {newDates.length} {newDates.length === 1 ? "día" : "días"}{duration === "day" ? " · Día completo" : ""}
              </p>
              {excludedCount > 0 && (
                <p className="text-[11px] text-navy/40 mt-1">
                  {excludedCount} {excludedCount === 1 ? "día excluido" : "días excluidos"} (fin de semana o festivo)
                </p>
              )}
            </div>

            {newDates.length > 0 && (
              <div className="border-t border-navy/[0.07] pt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-navy/55">
                  <span>Duración ausencia</span>
                  <span className="font-medium text-navy">{newDates.length}</span>
                </div>
                {isVacaciones && (
                  <>
                    <div className="flex justify-between text-xs text-navy/55">
                      <span>Días usados</span>
                      <span className="font-medium text-navy">{vacUsadas}</span>
                    </div>
                    <div className="flex justify-between text-xs text-navy/55">
                      <span>Restantes</span>
                      <span className={`font-medium ${totalVacaciones(persona) - vacUsadas - newDates.length < 0 ? "text-danger" : "text-navy"}`}>
                        {totalVacaciones(persona) - vacUsadas - newDates.length}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
    </Drawer>
  );
}

// ── Resumen ausencias modal ───────────────────────────────────────────────────

function AusenciasModal({ persona, idx, onClose }: { persona: Persona; idx: number; onClose: () => void }) {
  const colors = PERSON_COLORS[idx];
  const vacUsadas = inYear(persona.vacaciones).length;
  const total = totalVacaciones(persona);
  const baseAnual = baseAnualVacaciones(persona);
  const hireYear = parseInt(persona.inicioContrato.slice(0, 4), 10) || YEAR;

  return (
    <Drawer title="Resumen de ausencias" subtitle={`${persona.nombre} · ${YEAR}`} onClose={onClose} maxWidth="max-w-sm">
        <div className="px-6 py-4 space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className="text-sm font-medium text-navy">Vacaciones</span>
              </div>
              <span className="text-sm font-medium text-navy tabular-nums">{vacUsadas} / {total} días</span>
            </div>
            <div className="ml-4 mt-1.5 space-y-1">
              <div className="flex justify-between text-xs text-navy/55">
                <span>{YEAR > hireYear ? "Según convenio" : "Según convenio (proporcional)"}</span>
                <span>{baseAnual} días</span>
              </div>
              <div className="flex justify-between text-xs text-navy/55">
                <span>Días extra concedidos</span>
                <span className={persona.diasExtra > 0 ? "text-navy font-medium" : ""}>
                  {persona.diasExtra > 0 ? `+${persona.diasExtra}` : persona.diasExtra} días
                </span>
              </div>
              <div className="flex justify-between text-xs text-navy/55">
                <span>Planificados</span>
                <span>{vacUsadas} días</span>
              </div>
              <div className="flex justify-between text-xs text-navy/55">
                <span>Restantes</span>
                <span>{total - vacUsadas} días</span>
              </div>
            </div>
          </div>

          <div className="border-t border-navy/5" />

          {ABSENCE_TYPES.slice(1).map((t) => {
            const days = inYear(getAbsenceDates(persona, t.key)).length;
            return (
              <div key={t.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.dotHex }} />
                  <span className="text-sm text-navy/70">{t.label}</span>
                </div>
                {days > 0 ? (
                  <span className="text-sm font-medium text-navy tabular-nums">{days} {days === 1 ? "día" : "días"}</span>
                ) : (
                  <span className="text-xs bg-navy/5 text-navy/45 px-2 py-0.5 rounded">sin registros</span>
                )}
              </div>
            );
          })}
        </div>
    </Drawer>
  );
}

// ── SVG donut ─────────────────────────────────────────────────────────────────

function Donut({ used, total, stroke }: { used: number; total: number; stroke: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? used / total : 0;
  const dash = pct * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-border)" strokeWidth="7" />
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

function DateBadge({ dateStr }: { dateStr: string }) {
  const d = new Date(dateStr + "T12:00:00");
  return (
    <div className="w-12 shrink-0 bg-navy/5 rounded text-center py-1.5">
      <p className="text-sm font-semibold text-navy leading-tight">{d.getDate()}</p>
      <p className="text-[10px] text-navy/50 uppercase">{MONTH_SHORT[d.getMonth()]}</p>
    </div>
  );
}

// ── Editor de días extra (dentro del modo edición) ────────────────────────────

function DiasExtraEditor({ current, onSave }: { current: number; onSave: (v: number) => Promise<void> }) {
  const [val, setVal] = useState(current);
  const [saving, setSaving] = useState(false);
  useEffect(() => setVal(current), [current]);
  const dirty = val !== current;

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(val);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 border border-navy/10 rounded-lg px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-navy">Días extra</p>
          <p className="text-[10px] text-navy/45">Se suman a los del convenio</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setVal((v) => Math.max(0, v - 1))}
            disabled={val <= 0}
            className="w-6 h-6 rounded-md border border-navy/15 text-navy/60 hover:text-navy hover:border-navy/30 disabled:opacity-30 transition-colors flex items-center justify-center leading-none"
          >−</button>
          <input
            type="number" min={0} max={365} value={val}
            onChange={(e) => setVal(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            className="w-12 text-center text-sm border border-navy/[0.12] rounded-md py-1 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy tabular-nums"
          />
          <button
            type="button"
            onClick={() => setVal((v) => Math.min(365, v + 1))}
            className="w-6 h-6 rounded-md border border-navy/15 text-navy/60 hover:text-navy hover:border-navy/30 transition-colors flex items-center justify-center leading-none"
          >+</button>
        </div>
      </div>
      {dirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-2 w-full text-xs font-semibold text-app-bg bg-navy hover:bg-navy/85 rounded-md py-1.5 transition-colors disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Guardar días extra"}
        </button>
      )}
    </div>
  );
}

function PersonCard({
  persona,
  idx,
  festivos,
  onAdd,
  onDeleteRange,
  onArchive,
  onUpdateDiasExtra,
}: {
  persona: Persona;
  idx: number;
  festivos: string[];
  onAdd: (typeKey: AbsenceKey, dates: string[]) => Promise<void>;
  onDeleteRange: (typeKey: AbsenceKey, start: string, end: string) => Promise<void>;
  onArchive: () => Promise<void>;
  onUpdateDiasExtra: (diasExtra: number) => Promise<void>;
}) {
  const [showModal, setShowModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const colors = PERSON_COLORS[idx % PERSON_COLORS.length];
  const used = inYear(persona.vacaciones).length;
  const total = totalVacaciones(persona);
  const remaining = total - used;

  const allRanges = ABSENCE_TYPES.flatMap((t) =>
    groupRanges(getAbsenceDates(persona, t.key)).map((r) => ({ ...r, typeKey: t.key, typeLabel: t.label, dotHex: t.dotHex }))
  ).sort((a, b) => b.start.localeCompare(a.start));

  const upcoming = allRanges.filter((r) => r.end >= TODAY);
  const past = allRanges.filter((r) => r.end < TODAY);

  async function handleArchive() {
    setConfirmArchive(false);
    setArchiving(true);
    await onArchive();
  }

  const TrashIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );

  return (
    <>
      {showModal && <AusenciasModal persona={persona} idx={idx} onClose={() => setShowModal(false)} />}
      {showAddModal && (
        <AñadirAusenciaModal
          persona={persona}
          festivos={festivos}
          onClose={() => setShowAddModal(false)}
          onAdd={onAdd}
        />
      )}
      <div className="bg-card border border-border rounded-[14px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-navy/5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-navy">{persona.nombre}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditMode((v) => !v)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                  editMode
                    ? "bg-navy/5 border-navy/20 text-navy"
                    : "border-navy/15 text-navy/55 hover:text-navy hover:border-navy/30"
                }`}
              >
                {editMode ? "Listo" : "Editar"}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 text-xs text-app-bg bg-navy px-2.5 py-1 rounded-lg hover:bg-navy/85 transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Añadir
              </button>
            </div>
          </div>

          {/* Donut + stats */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <Donut used={used} total={total} stroke={colors.stroke} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-sm font-semibold text-navy leading-tight">{used}</p>
                <p className="text-[9px] text-navy/55 leading-tight">de {total}</p>
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
                <p className={`text-2xl font-semibold ${remaining < 0 ? "text-danger" : "text-navy/55"}`}>{remaining}</p>
                {persona.diasExtra > 0 && (
                  <p className="text-[10px] text-income/80 mt-0.5">incl. +{persona.diasExtra} extra</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Absence list */}
        <div className="px-5 py-4 space-y-4 flex-1">
          {used === 0 && <p className="text-xs text-warning">Sin días planificados aún</p>}

          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-medium text-navy/55 mb-2">Próximas ausencias ({upcoming.length})</p>
              <div className="space-y-2">
                {upcoming.map((r) => {
                  const { label, days } = formatPeriod(r.start, r.end, r.count);
                  return (
                    <div key={`${r.typeKey}-${r.start}`} className="flex items-center gap-3">
                      <DateBadge dateStr={r.start} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: r.dotHex }} />
                          <p className="text-sm font-medium text-navy">{r.typeLabel}</p>
                        </div>
                        <p className="text-xs text-navy/55">{label} ({days})</p>
                      </div>
                      <div className="shrink-0">
                        {editMode ? (
                          <button
                            onClick={() => onDeleteRange(r.typeKey, r.start, r.end)}
                            className="flex items-center gap-1 text-xs text-danger border border-danger/30 bg-danger/5 hover:bg-danger/10 px-2 py-1 rounded-lg transition-colors"
                          >
                            <TrashIcon />
                            Eliminar
                          </button>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center">
                            <span className="text-success text-xs">✓</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <p className="text-xs font-medium text-navy/55 mb-2">Ausencias anteriores ({past.length})</p>
              <div className="space-y-2">
                {past.map((r) => {
                  const { label, days } = formatPeriod(r.start, r.end, r.count);
                  return (
                    <div key={`${r.typeKey}-${r.start}`} className="flex items-center gap-3">
                      <DateBadge dateStr={r.start} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-navy/20 shrink-0" />
                          <p className="text-sm text-navy/50">{r.typeLabel}</p>
                        </div>
                        <p className="text-xs text-navy/45">{label} ({days})</p>
                      </div>
                      <div className="shrink-0">
                        {editMode ? (
                          <button
                            onClick={() => onDeleteRange(r.typeKey, r.start, r.end)}
                            className="flex items-center gap-1 text-xs text-danger border border-danger/30 bg-danger/5 hover:bg-danger/10 px-2 py-1 rounded-lg transition-colors"
                          >
                            <TrashIcon />
                            Eliminar
                          </button>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-navy/5 flex items-center justify-center">
                            <span className="text-navy/45 text-xs">✓</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Días extra + archivar - visibles solo en modo edición */}
          {editMode && (
            <DiasExtraEditor current={persona.diasExtra} onSave={onUpdateDiasExtra} />
          )}
          {editMode && (
            confirmArchive ? (
              <div className="mt-2 flex items-center gap-2">
                <p className="flex-1 text-xs text-navy/55">No aparecerá en instructores activos.</p>
                <button
                  onClick={() => setConfirmArchive(false)}
                  className="text-xs text-navy/40 hover:text-navy transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleArchive}
                  disabled={archiving}
                  className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors disabled:opacity-50"
                >
                  {archiving ? "Archivando…" : "Sí, archivar"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmArchive(true)}
                className="mt-2 w-full text-xs text-navy/45 hover:text-danger border border-navy/10 hover:border-danger/30 rounded-lg py-2 transition-colors"
              >
                Archivar instructor
              </button>
            )
          )}
        </div>

        {/* Ver ausencias - fijo al pie */}
        <div className="border-t border-navy/[0.05] px-5 py-3">
          <button
            onClick={() => setShowModal(true)}
            className="w-full text-xs text-navy/45 hover:text-primary transition-colors text-center py-0.5"
          >
            Ver resumen de ausencias
          </button>
        </div>
      </div>
    </>
  );
}

// ── Overlap calendar ──────────────────────────────────────────────────────────

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
                <span key={i} className={`text-xs px-2 py-0.5 rounded ${PERSON_COLORS[i % PERSON_COLORS.length].badge}`}>
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

// ── Annual calendar ───────────────────────────────────────────────────────────

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
    const i = allPersonas.findIndex((orig) => orig.id === p.id);
    p.vacaciones.forEach((d) => {
      if (!vacByDate.has(d)) vacByDate.set(d, []);
      vacByDate.get(d)!.push(i);
    });
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {MONTH_NAMES.map((monthName, mi) => {
        const month = mi + 1;
        const { daysInMonth, startOffset } = buildCalendar(YEAR, month);
        const cells = Array.from({ length: startOffset + daysInMonth }, (_, idx) => {
          if (idx < startOffset) return null;
          const day = idx - startOffset + 1;
          const dateStr = `${YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isFestivo = festivosSet.has(dateStr);
          const personasVac = vacByDate.get(dateStr) ?? [];
          const isSolapamiento = personasVac.length >= 2;
          const isToday = dateStr === TODAY;
          return { day, dateStr, isFestivo, personasVac, isSolapamiento, isToday };
        });

        const monthVac = personas.map((p) => {
          const i = allPersonas.findIndex((orig) => orig.id === p.id);
          return {
            name: p.nombre,
            days: p.vacaciones
              .filter((d) => d.startsWith(`${YEAR}-${String(month).padStart(2, "0")}-`))
              .map((d) => parseInt(d.split("-")[2])),
            colors: PERSON_COLORS[i % PERSON_COLORS.length],
          };
        }).filter((p) => p.days.length > 0);

        return (
          <div key={month} className="bg-card border border-border rounded-[14px] overflow-hidden">
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
                        : personasVac.length === 1
                        ? (PERSON_COLORS[personasVac[0] % PERSON_COLORS.length]?.cellBg ?? "")
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
                          <div key={pi} className={`w-1.5 h-1.5 rounded-full ${PERSON_COLORS[pi % PERSON_COLORS.length].dot}`} />
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
                    <span className="text-[12px] text-navy/50">
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

// ── Gantt ─────────────────────────────────────────────────────────────────────

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

  const vacByDate = new Map<string, number[]>();
  allPersonas.forEach((p, i) => {
    p.vacaciones.forEach((d) => {
      if (!vacByDate.has(d)) vacByDate.set(d, []);
      vacByDate.get(d)!.push(i);
    });
  });

  const months = Array.from({ length: 12 }, (_, mi) => {
    const month = mi + 1;
    const daysInMonth = new Date(YEAR, month, 0).getDate();
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${YEAR}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const jsDay = new Date(ds + "T12:00:00").getDay();
      if (jsDay !== 0 && jsDay !== 6 && !festivosSet.has(ds)) workingDays++;
    }
    const isCurrentMonth = TODAY.startsWith(`${YEAR}-${String(month).padStart(2, "0")}-`);
    return { month, name: MONTH_SHORT[mi], daysInMonth, workingDays, isCurrentMonth };
  });

  return (
    <div className="bg-card border border-border rounded-[14px] p-5">
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

      <div className="space-y-2">
        {personas.map((p) => {
          const i = allPersonas.findIndex((orig) => orig.id === p.id);
          const colors = PERSON_COLORS[i % PERSON_COLORS.length];

          return (
            <div key={p.id} className="flex items-center">
              <span className="w-24 shrink-0 text-xs text-navy/60 pr-3 truncate">{p.nombre}</span>
              <div className="flex-1 grid grid-cols-12 gap-1">
                {months.map((m) => {
                  const prefix = `${YEAR}-${String(m.month).padStart(2, "0")}-`;
                  const vacDays = p.vacaciones.filter((d) => d.startsWith(prefix));
                  const overlapDays = vacDays.filter((d) => (vacByDate.get(d)?.length ?? 0) >= 2);
                  const fillPct = m.workingDays > 0 ? (vacDays.length / m.workingDays) * 100 : 0;
                  const hasOverlap = overlapDays.length > 0;
                  const tooltip = vacDays.length > 0
                    ? `${p.nombre} · ${vacDays.map((d) => parseInt(d.split("-")[2])).join(", ")} ${MONTH_SHORT[m.month - 1]}`
                    : "";

                  return (
                    <div key={m.month} className="relative h-9 bg-navy/[0.04] rounded overflow-hidden" title={tooltip}>
                      {fillPct > 0 && (
                        <div
                          className={`absolute inset-y-1 left-1 rounded ${
                            hasOverlap ? "bg-danger/60" : colors.dot + " opacity-75"
                          }`}
                          style={{ width: `calc(${fillPct}% - 4px)`, minWidth: "6px" }}
                        />
                      )}
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

      <div className="flex items-center mt-3 pt-3 border-t border-navy/5">
        <span className="w-24 shrink-0 text-[10px] text-navy/45 pr-3">Festivos</span>
        <div className="flex-1 grid grid-cols-12 gap-1">
          {months.map((m) => {
            const prefix = `${YEAR}-${String(m.month).padStart(2, "0")}-`;
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

      <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-navy/5">
        {personas.map((p) => {
          const i = allPersonas.findIndex((orig) => orig.id === p.id);
          return (
            <div key={p.id} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${PERSON_COLORS[i % PERSON_COLORS.length].dot} opacity-75`} />
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

// ── Main export ───────────────────────────────────────────────────────────────

export default function VacacionesCalendario({
  personas: initialPersonas,
  festivos,
}: {
  personas: Persona[];
  festivos: string[];
}) {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas);
  const [filtro, setFiltro] = useState<string>("todas");
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [showArchivados, setShowArchivados] = useState(false);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const suggestionsCount = generateSuggestions(personas, festivos).length;
  const [archivados, setArchivados] = useState<{ id: string; nombre: string; inicio_contrato: string; dias_totales: number }[]>([]);
  const [loadingArchivados, setLoadingArchivados] = useState(false);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Aviso de error a la vista, en vez de un alert() nativo del navegador (sin estilo, rompe
  // con el resto de la app) - un solo hueco para las tres acciones de PersonCard, que no viven
  // dentro de ningún modal donde mostrarlo en línea.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleDelete(id: string, nombre: string) {
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await deletePersonaAction(id);
      setArchivados((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function openArchivados() {
    setShowArchivados(true);
    setLoadingArchivados(true);
    try {
      const data = await loadArchivedPersonasAction();
      setArchivados(data);
    } finally {
      setLoadingArchivados(false);
    }
  }

  async function handleUnarchive(id: string) {
    setUnarchivingId(id);
    try {
      await unarchivePersonaAction(id);
      setArchivados((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } finally {
      setUnarchivingId(null);
    }
  }

  const handleAdd = useCallback(async (personaId: string, typeKey: AbsenceKey, dates: string[]) => {
    setPersonas((prev) =>
      prev.map((p) => {
        if (p.id !== personaId) return p;
        const existing = getAbsenceDates(p, typeKey);
        return { ...p, [typeKey]: [...new Set([...existing, ...dates])].sort() };
      })
    );
    try {
      await addAusenciasAction(personaId, typeKey, dates);
      router.refresh();
    } catch (err) {
      // Rollback on error
      setPersonas((prev) =>
        prev.map((p) => {
          if (p.id !== personaId) return p;
          return { ...p, [typeKey]: getAbsenceDates(p, typeKey).filter((d) => !dates.includes(d)) };
        })
      );
      throw err;
    }
  }, [router]);

  const handleDeleteRange = useCallback(async (personaId: string, typeKey: AbsenceKey, start: string, end: string) => {
    const snapshot = personas;
    setPersonas((prev) =>
      prev.map((p) => {
        if (p.id !== personaId) return p;
        const existing = getAbsenceDates(p, typeKey);
        return { ...p, [typeKey]: existing.filter((d) => d < start || d > end) };
      })
    );
    try {
      await removeAusenciasAction(personaId, typeKey, start, end);
      router.refresh();
    } catch (err) {
      setPersonas(snapshot);
      setErrorMsg("Error al eliminar la ausencia. Inténtalo de nuevo.");
      console.error(err);
    }
  }, [router, personas]);

  const handleUpdateDiasExtra = useCallback(async (personaId: string, diasExtra: number) => {
    const snapshot = personas;
    setPersonas((prev) => prev.map((p) => (p.id === personaId ? { ...p, diasExtra } : p)));
    try {
      await updatePersonaDiasExtraAction(personaId, diasExtra);
      router.refresh();
    } catch (err) {
      setPersonas(snapshot);
      setErrorMsg("Error al guardar los días extra. Inténtalo de nuevo.");
      console.error(err);
    }
  }, [router, personas]);

  const handleArchive = useCallback(async (personaId: string) => {
    const snapshot = personas;
    setPersonas((prev) => prev.filter((p) => p.id !== personaId));
    try {
      await archivePersonaAction(personaId);
      router.refresh();
    } catch (err) {
      setPersonas(snapshot);
      setErrorMsg("Error al archivar. Inténtalo de nuevo.");
      console.error(err);
    }
  }, [router, personas]);

  const handleCreate = useCallback(async (data: { nombre: string; inicio_contrato: string; jornada_dias: number; dias_totales: number }) => {
    await createPersonaAction(data);
    router.refresh();
  }, [router]);

  const personasFiltradas = filtro === "todas"
    ? personas
    : personas.filter((p) => p.id === filtro);

  return (
    <div className="space-y-8">
      {showNuevoModal && (
        <NuevoInstructorModal
          onClose={() => setShowNuevoModal(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Sugerencias / Archivados / Nuevo instructor: viven en el header (junto al título),
          no en una fila propia - por eso ya no hace falta la cabecera "Instructores" aquí. */}
      <HeaderPortal>
        <div className="flex items-center gap-2.5">
          <IconButtonV2 onClick={() => setShowSugerencias(true)} title="Sugerencias" className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
            </svg>
            {suggestionsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#b45309] dark:bg-[#e8a572] border border-white" />
            )}
          </IconButtonV2>
          <IconButtonV2 onClick={openArchivados} title="Archivados">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
          </IconButtonV2>
          <PrimaryButtonV2
            onClick={() => setShowNuevoModal(true)}
            label="Nuevo instructor"
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
          />
        </div>
      </HeaderPortal>

      {showSugerencias && (
        <Drawer title="Sugerencias" onClose={() => setShowSugerencias(false)}>
          <div className="p-4">
            {suggestionsCount === 0 ? (
              <p className="text-sm text-navy/40 text-center py-8">Sin sugerencias por ahora.</p>
            ) : (
              <SugerenciasBlock personas={personas} festivos={festivos} />
            )}
          </div>
        </Drawer>
      )}

      {/* Drawer de archivados */}
      {showArchivados && (
        <Drawer
          title="Instructores archivados"
          subtitle="Puedes reactivarlos en cualquier momento"
          onClose={() => setShowArchivados(false)}
        >
          {loadingArchivados ? (
            <p className="px-6 py-8 text-sm text-navy/40 text-center">Cargando…</p>
          ) : archivados.length === 0 ? (
            <p className="px-6 py-8 text-sm text-navy/40 text-center">Sin instructores archivados</p>
          ) : (
            <div className="divide-y divide-navy/[0.05]">
              {archivados.map((p) => (
                <div key={p.id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-navy">{p.nombre}</p>
                    <p className="text-xs text-navy/45 mt-0.5">
                      Contrato: {p.inicio_contrato?.split("-").reverse().join("/")} · {p.dias_totales} días/año
                    </p>
                  </div>
                  {confirmDeleteId === p.id ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-navy/55 whitespace-nowrap">¿Definitivo?</span>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-navy/40 hover:text-navy transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.nombre)}
                        disabled={deletingId === p.id}
                        className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors disabled:opacity-50"
                      >
                        {deletingId === p.id ? "Eliminando…" : "Sí, eliminar"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleUnarchive(p.id)}
                        disabled={unarchivingId === p.id}
                        className="text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {unarchivingId === p.id ? "Reactivando…" : "Reactivar"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="text-xs font-semibold text-danger/70 border border-danger/20 hover:bg-danger/5 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Drawer>
      )}

      {/* Aviso de error de guardado - sustituye a los alert() nativos que rompían con el
          estilo del resto de la app y no respetaban modo oscuro */}
      {errorMsg && (
        <div className="flex items-center justify-between gap-3 bg-danger/[0.06] border border-danger/20 rounded-[14px] px-4 py-3">
          <p className="text-sm text-danger">{errorMsg}</p>
          <button
            onClick={() => setErrorMsg(null)}
            className="shrink-0 text-danger/50 hover:text-danger transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Alertas de solapamiento */}
      {filtro === "todas" && <OverlapCalendar personas={personas} />}

      {/* Tarjetas por persona */}
      <div className={`grid gap-5 ${personasFiltradas.length === 1 ? "max-w-sm" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {personasFiltradas.map((p) => {
          const i = personas.findIndex((orig) => orig.id === p.id);
          return (
            <PersonCard
              key={p.id}
              persona={p}
              idx={i}
              onAdd={(typeKey, dates) => handleAdd(p.id, typeKey, dates)}
              onDeleteRange={(typeKey, start, end) => handleDeleteRange(p.id, typeKey, start, end)}
              onArchive={() => handleArchive(p.id)}
              onUpdateDiasExtra={(diasExtra) => handleUpdateDiasExtra(p.id, diasExtra)}
              festivos={festivos}
            />
          );
        })}
      </div>

      {/* Vista Gantt - solo desktop */}
      <section className="hidden sm:block">
        <h2 className="text-xs font-semibold text-navy/55 uppercase tracking-widest mb-4">Vista anual</h2>
        <GanttView personas={personasFiltradas} allPersonas={personas} festivos={festivos} />
      </section>

      {/* Calendario mensual */}
      <section>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-xs font-semibold text-navy/55 uppercase tracking-widest">Calendario {YEAR}</h2>
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-navy/55 shrink-0">Ver:</span>
            <FilterPillGroupV2
              active={filtro}
              onChange={setFiltro}
              options={[{ key: "todas", label: "Todas" }, ...personas.map((p) => ({ key: p.id, label: p.nombre }))]}
            />
          </div>
        </div>
        <AnnualCalendar personas={personasFiltradas} allPersonas={personas} festivos={festivos} />
      </section>

      <p className="text-[10px] text-navy/45">
        Convenio: 23 días laborales por año completo a jornada de 5 días/semana. Días proporcionales a jornada y fecha de inicio de contrato.
      </p>
    </div>
  );
}
