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
