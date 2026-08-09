export type RangeKey =
  | "today" | "yesterday"
  | "this-week" | "prev-week"
  | "month" | "prev-month"
  | "this-quarter" | "prev-quarter"
  | "year" | "prev-year"
  | "all" | "custom";

export type DateRange = {
  from: string | null;
  to: string | null;
  label: string;
};

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today",         label: "Hoy" },
  { key: "yesterday",     label: "Ayer" },
  { key: "this-week",     label: "Esta semana" },
  { key: "prev-week",     label: "Semana pasada" },
  { key: "month",         label: "Este mes" },
  { key: "prev-month",    label: "Mes pasado" },
  { key: "this-quarter",  label: "Este trimestre" },
  { key: "prev-quarter",  label: "Trimestre pasado" },
  { key: "year",          label: "Este año" },
  { key: "prev-year",     label: "Año pasado" },
  { key: "all",           label: "Desde el inicio" },
  { key: "custom",        label: "Rango personalizado" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fecha de hoy en el huso horario local, como "YYYY-MM-DD". A diferencia de
 * `new Date().toISOString().slice(0, 10)`, no se adelanta un día durante la madrugada en
 * verano (Madrid UTC+2): toISOString() siempre da la fecha en UTC. */
export function todayLocalISO(): string {
  return fmt(new Date());
}

export function getDateRange(range: string | null | undefined): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  switch (range) {
    case "today": {
      const d = fmt(now);
      return { from: d, to: d, label: "Hoy" };
    }
    case "yesterday": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const ds = fmt(d);
      return { from: ds, to: ds, label: "Ayer" };
    }
    case "this-week": {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - daysSinceMonday);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun), label: "Esta semana" };
    }
    case "prev-week": {
      const daysSinceMonday = (now.getDay() + 6) % 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - daysSinceMonday - 7);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun), label: "Semana pasada" };
    }
    case "month": {
      const from = `${y}-${pad(m + 1)}-01`;
      const to = fmt(new Date(y, m + 1, 0));
      return { from, to, label: "Este mes" };
    }
    case "prev-month": {
      const prevM = m === 0 ? 11 : m - 1;
      const prevY = m === 0 ? y - 1 : y;
      const from = `${prevY}-${pad(prevM + 1)}-01`;
      const to = fmt(new Date(prevY, prevM + 1, 0));
      return { from, to, label: "Mes pasado" };
    }
    case "this-quarter": {
      const q = Math.floor(m / 3);
      const from = `${y}-${pad(q * 3 + 1)}-01`;
      const to = fmt(new Date(y, q * 3 + 3, 0));
      return { from, to, label: "Este trimestre" };
    }
    case "prev-quarter": {
      const q = Math.floor(m / 3);
      const pq = q === 0 ? 3 : q - 1;
      const py = q === 0 ? y - 1 : y;
      const from = `${py}-${pad(pq * 3 + 1)}-01`;
      const to = fmt(new Date(py, pq * 3 + 3, 0));
      return { from, to, label: "Trimestre pasado" };
    }
    case "year": {
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: "Este año" };
    }
    case "prev-year": {
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: "Año pasado" };
    }
    // Legacy key kept for URL backward compat
    case "3months": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { from: fmt(d), to: fmt(now), label: "Últimos 3 meses" };
    }
    default:
      return { from: null, to: null, label: "Desde el inicio" };
  }
}

export function getComparisonRangeKey(range: string | null | undefined): string | null {
  const map: Record<string, string> = {
    "today":        "yesterday",
    "this-week":    "prev-week",
    "month":        "prev-month",
    "this-quarter": "prev-quarter",
    "year":         "prev-year",
  };
  return range ? (map[range] ?? null) : null;
}
