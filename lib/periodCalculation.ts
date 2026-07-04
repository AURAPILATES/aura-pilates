export type PeriodSearchParams = Record<string, string | string[] | undefined>;

export interface ResolvedPeriod {
  from: string;
  to: string;
  compFrom: string;
  compTo: string;
  /** Etiqueta corta del período principal, ej. "30 días" o "12/03/26–11/04/26" */
  periodLabel: string;
  /** Rango "dd/mm/aa–dd/mm/aa" del período de comparación */
  compDateRange: string;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to + "T12:00:00").getTime() - new Date(from + "T12:00:00").getTime()) / 86400000,
  );
}

function fmtShort(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

function str(v: string | string[] | undefined, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * Resuelve period/from/to/compareWith/compareFrom/compareTo (params de URL compartidos
 * por Finanzas, Clientes y Horario) a un rango principal y un rango de comparación.
 * Antes esta lógica vivía duplicada palabra por palabra en las 3 páginas.
 */
export function resolvePeriod(
  sp: PeriodSearchParams,
  opts: { sinceDate?: string; defaultPeriod?: string } = {},
): ResolvedPeriod {
  const sinceDate = opts.sinceDate ?? "2026-02-01";
  const periodParam = str(sp.period, opts.defaultPeriod ?? "30");
  const customFrom = str(sp.from);
  const customTo = str(sp.to);
  const compareParam = str(sp.compareWith, "previous");
  const cpFrom = str(sp.compareFrom);
  const cpTo = str(sp.compareTo);

  const todayStr = new Date().toISOString().split("T")[0];

  let from: string;
  let to: string = todayStr;

  if (periodParam === "custom" && customFrom && customTo) {
    from = customFrom;
    to = customTo;
  } else if (periodParam === "all") {
    from = sinceDate;
  } else {
    const days = periodParam === "7" ? 7 : periodParam === "90" ? 90 : 30;
    from = addDays(todayStr, -days);
  }

  let compFrom: string;
  let compTo: string;

  if (compareParam === "custom" && cpFrom && cpTo) {
    compFrom = cpFrom;
    compTo = cpTo;
  } else {
    const duration = daysBetween(from, to);
    compTo = addDays(from, -1);
    compFrom = addDays(compTo, -duration);
  }

  const periodLabel =
    periodParam === "7" ? "7 días" :
    periodParam === "30" ? "30 días" :
    periodParam === "90" ? "90 días" :
    periodParam === "all" ? "Desde el inicio" :
    `${fmtShort(from)}–${fmtShort(to)}`;

  const compDateRange = `${fmtShort(compFrom)}–${fmtShort(compTo)}`;

  return { from, to, compFrom, compTo, periodLabel, compDateRange };
}

export { pad2, addDays, daysBetween, fmtShort };

// ── Calendar-based period resolver (Analítica) ────────────────────────────────

function lastDayOf(year: number, month: number): string {
  const day = new Date(year, month, 0).getDate();
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function quarterRange(year: number, q: number): { from: string; to: string } {
  const startM = (q - 1) * 3 + 1;
  const endM = q * 3;
  return { from: `${year}-${pad2(startM)}-01`, to: lastDayOf(year, endM) };
}

function prevQuarter(year: number, q: number): { year: number; q: number } {
  return q === 1 ? { year: year - 1, q: 4 } : { year, q: q - 1 };
}

/**
 * Resuelve los params de URL del filtro de Analítica (period/year/compareWith)
 * a rangos de fechas concretos.
 *
 * period: month_01..month_12 | q1..q4 | year
 * year: e.g. 2025, 2026
 * compareWith: previous | year_ago | none
 */
export function resolveCalendarPeriod(sp: PeriodSearchParams): ResolvedPeriod {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const todayStr = now.toISOString().split("T")[0];

  const yearParam = parseInt(str(sp.year, String(currentYear)));
  const year = isNaN(yearParam) ? currentYear : yearParam;
  const defaultPeriod = `month_${pad2(currentMonth)}`;
  const periodType = str(sp.period, defaultPeriod);
  const compareWith = str(sp.compareWith, "previous");

  let from: string;
  let to: string;
  const MES_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  let periodLabel: string;

  if (periodType === "all") {
    from = "2025-01-01";
    to = todayStr;
    periodLabel = "Desde el inicio";
    return { from, to, compFrom: from, compTo: from, periodLabel, compDateRange: "—" };
  } else if (periodType === "custom") {
    const customFrom = str(sp.from);
    const customTo = str(sp.to);
    from = customFrom || `${year}-01-01`;
    to = customTo || todayStr;
    const fromParts = from.split("-").map(Number);
    const toParts = to.split("-").map(Number);
    const fromLabel = `${fromParts[2]} ${MES_ES[fromParts[1] - 1].toLowerCase()}`;
    const toLabel = `${toParts[2]} ${MES_ES[toParts[1] - 1].toLowerCase()}`;
    periodLabel = `${fromLabel} - ${toLabel} ${toParts[0]}`;
  } else if (periodType === "year") {
    from = `${year}-01-01`;
    to = `${year}-12-31`;
    periodLabel = String(year);
  } else if (/^q[1-4]$/.test(periodType)) {
    const q = parseInt(periodType[1]);
    const r = quarterRange(year, q);
    from = r.from;
    to = r.to;
    periodLabel = `${q}T ${year}`;
  } else if (/^month_\d{2}$/.test(periodType)) {
    const m = parseInt(periodType.slice(6));
    from = `${year}-${pad2(m)}-01`;
    to = lastDayOf(year, m);
    periodLabel = `${MES_ES[m - 1]} ${year}`;
  } else {
    from = `${year}-${pad2(currentMonth)}-01`;
    to = lastDayOf(year, currentMonth);
    periodLabel = `${MES_ES[currentMonth - 1]} ${year}`;
  }

  if (to > todayStr) to = todayStr;

  let compFrom: string;
  let compTo: string;

  if (compareWith === "none") {
    compFrom = from;
    compTo = from;
  } else if (compareWith === "year_ago") {
    const prevYear = year - 1;
    if (periodType === "year") {
      compFrom = `${prevYear}-01-01`;
      compTo = `${prevYear}-12-31`;
    } else if (/^q[1-4]$/.test(periodType)) {
      const q = parseInt(periodType[1]);
      const r = quarterRange(prevYear, q);
      compFrom = r.from;
      compTo = r.to;
    } else if (periodType === "custom") {
      const fromD = new Date(from + "T12:00:00");
      const toD = new Date(to + "T12:00:00");
      fromD.setFullYear(fromD.getFullYear() - 1);
      toD.setFullYear(toD.getFullYear() - 1);
      compFrom = fromD.toISOString().split("T")[0];
      compTo = toD.toISOString().split("T")[0];
    } else {
      const m = parseInt(periodType.slice(6));
      compFrom = `${prevYear}-${pad2(m)}-01`;
      compTo = lastDayOf(prevYear, m);
    }
  } else {
    // previous
    if (periodType === "year") {
      compFrom = `${year - 1}-01-01`;
      compTo = `${year - 1}-12-31`;
    } else if (/^q[1-4]$/.test(periodType)) {
      const q = parseInt(periodType[1]);
      const { year: py, q: pq } = prevQuarter(year, q);
      const r = quarterRange(py, pq);
      compFrom = r.from;
      compTo = r.to;
    } else if (periodType === "custom") {
      const duration = daysBetween(from, to);
      compTo = addDays(from, -1);
      compFrom = addDays(compTo, -duration);
    } else {
      const m = parseInt(periodType.slice(6));
      const { year: py, month: pm } = prevMonth(year, m);
      compFrom = `${py}-${pad2(pm)}-01`;
      compTo = lastDayOf(py, pm);
    }
  }

  const compDateRange = compareWith === "none" ? "—" : `${fmtShort(compFrom)}–${fmtShort(compTo)}`;

  return { from, to, compFrom, compTo, periodLabel, compDateRange };
}
