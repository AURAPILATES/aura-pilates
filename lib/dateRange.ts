export type RangeKey = "all" | "month" | "prev-month" | "3months" | "year";

export type DateRange = {
  from: string | null;
  to: string | null;
  label: string;
};

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "all",        label: "Todo" },
  { key: "month",      label: "Este mes" },
  { key: "prev-month", label: "Mes anterior" },
  { key: "3months",    label: "Últimos 3 meses" },
  { key: "year",       label: "Este año" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getDateRange(range: string | null | undefined): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  switch (range) {
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
      return { from, to, label: "Mes anterior" };
    }
    case "3months": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return { from: fmt(d), to: fmt(now), label: "Últimos 3 meses" };
    }
    case "year": {
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: "Este año" };
    }
    default:
      return { from: null, to: null, label: "Todo" };
  }
}
