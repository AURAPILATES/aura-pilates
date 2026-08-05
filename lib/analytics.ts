import { MomenceEvent } from "./momence";

export function filterActive(events: MomenceEvent[]) {
  return events.filter((e) => e.published && !e.isCancelled && !e.isDeleted);
}

export function filterPast(events: MomenceEvent[], days = 30) {
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return filterActive(events).filter((e) => {
    const d = new Date(e.dateTime);
    return d <= now && d >= from;
  });
}

export function filterPrevious(events: MomenceEvent[], days = 30) {
  const now = new Date();
  const to = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const from = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);
  return filterActive(events).filter((e) => {
    const d = new Date(e.dateTime);
    return d <= to && d >= from;
  });
}

export function trend(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function filterUpcoming(events: MomenceEvent[], days = 14) {
  const now = new Date();
  const to = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return filterActive(events).filter((e) => {
    const d = new Date(e.dateTime);
    return d >= now && d <= to;
  });
}

export function filterToday(events: MomenceEvent[]) {
  const todayKey = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Europe/Madrid",
  });
  return filterActive(events).filter((e) => {
    const key = new Date(e.dateTime).toLocaleDateString("sv-SE", {
      timeZone: "Europe/Madrid",
    });
    return key === todayKey;
  });
}

export function totalRevenue(events: MomenceEvent[]) {
  return events.reduce((sum, e) => sum + e.ticketsSold * e.fixedPrice, 0);
}

export function totalStudents(events: MomenceEvent[]) {
  return events.reduce((sum, e) => sum + e.ticketsSold, 0);
}

export function occupancyRate(events: MomenceEvent[]) {
  const totalCapacity = events.reduce((sum, e) => sum + e.capacity, 0);
  const totalSold = events.reduce((sum, e) => sum + e.ticketsSold, 0);
  return totalCapacity > 0 ? totalSold / totalCapacity : 0;
}

export function revenueByDay(events: MomenceEvent[]) {
  const map = new Map<string, number>();
  for (const e of events) {
    const key = new Date(e.dateTime).toLocaleDateString("sv-SE", {
      timeZone: "Europe/Madrid",
    });
    map.set(key, (map.get(key) ?? 0) + e.ticketsSold * e.fixedPrice);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
}

export function revenueByTeacher(events: MomenceEvent[]) {
  const map = new Map<
    string,
    { revenue: number; classes: number; students: number; capacity: number }
  >();
  for (const e of events) {
    const prev = map.get(e.teacher) ?? {
      revenue: 0,
      classes: 0,
      students: 0,
      capacity: 0,
    };
    map.set(e.teacher, {
      revenue: prev.revenue + e.ticketsSold * e.fixedPrice,
      classes: prev.classes + 1,
      students: prev.students + e.ticketsSold,
      capacity: prev.capacity + e.capacity,
    });
  }
  return Array.from(map.entries())
    .map(([teacher, data]) => ({
      teacher,
      ...data,
      occupancy: data.capacity > 0 ? data.students / data.capacity : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function revenueByType(events: MomenceEvent[]) {
  const map = new Map<
    string,
    { revenue: number; classes: number; students: number; capacity: number }
  >();
  for (const e of events) {
    const prev = map.get(e.title) ?? {
      revenue: 0,
      classes: 0,
      students: 0,
      capacity: 0,
    };
    map.set(e.title, {
      revenue: prev.revenue + e.ticketsSold * e.fixedPrice,
      classes: prev.classes + 1,
      students: prev.students + e.ticketsSold,
      capacity: prev.capacity + e.capacity,
    });
  }
  return Array.from(map.entries())
    .map(([type, data]) => ({
      type,
      ...data,
      occupancy: data.capacity > 0 ? data.students / data.capacity : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function groupByDay(events: MomenceEvent[]) {
  const map = new Map<string, MomenceEvent[]>();
  for (const e of events) {
    const key = new Date(e.dateTime).toLocaleDateString("sv-SE", {
      timeZone: "Europe/Madrid",
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, evts]) => ({
      dateKey,
      label: new Date(evts[0].dateTime).toLocaleDateString("es-ES", {
        timeZone: "Europe/Madrid",
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
      events: evts.sort(
        (a, b) =>
          new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
      ),
    }));
}

export const WEEKDAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MADRID_WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // 0=Lunes, matches WEEKDAY_LABELS

// Momence dateTime is UTC; class times must be read in Europe/Madrid, not the
// server process timezone (getHours()/getDay() would read UTC on Vercel).
export function madridWeekdayAndHour(dateTime: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(dateTime));
  const weekdayStr = parts.find((p) => p.type === "weekday")!.value;
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  return { weekday: MADRID_WEEKDAY_ORDER.indexOf(weekdayStr), hour };
}

export function occupancyByHour(events: MomenceEvent[]) {
  const map = new Map<number, { totalOcc: number; count: number }>();
  for (const e of filterActive(events)) {
    const { hour } = madridWeekdayAndHour(e.dateTime);
    const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
    const prev = map.get(hour) ?? { totalOcc: 0, count: 0 };
    map.set(hour, { totalOcc: prev.totalOcc + occ, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .map(([hour, { totalOcc, count }]) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      avgOcc: totalOcc / count,
      count,
    }))
    .sort((a, b) => a.hour - b.hour);
}

export function occupancyByWeekday(events: MomenceEvent[]) {
  const map = new Map<number, { totalOcc: number; count: number }>();
  for (const e of filterActive(events)) {
    const { weekday: wd } = madridWeekdayAndHour(e.dateTime);
    const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
    const prev = map.get(wd) ?? { totalOcc: 0, count: 0 };
    map.set(wd, { totalOcc: prev.totalOcc + occ, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .map(([wd, { totalOcc, count }]) => ({
      weekday: wd,
      label: WEEKDAY_LABELS[wd],
      avgOcc: totalOcc / count,
      count,
    }))
    .sort((a, b) => a.weekday - b.weekday);
}

export function occupancyByTeacher(events: MomenceEvent[]) {
  const map = new Map<string, { totalOcc: number; count: number }>();
  for (const e of filterActive(events)) {
    const teacher = e.teacher || "Sin asignar";
    const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
    const prev = map.get(teacher) ?? { totalOcc: 0, count: 0 };
    map.set(teacher, { totalOcc: prev.totalOcc + occ, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .map(([teacher, { totalOcc, count }]) => ({
      teacher,
      avgOcc: totalOcc / count,
      count,
    }))
    .sort((a, b) => b.avgOcc - a.avgOcc);
}

export function occupancyHeatmap(events: MomenceEvent[]) {
  const map = new Map<string, { totalOcc: number; count: number }>();
  for (const e of filterActive(events)) {
    const { weekday: wd, hour } = madridWeekdayAndHour(e.dateTime);
    const key = `${wd}-${hour}`;
    const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
    const prev = map.get(key) ?? { totalOcc: 0, count: 0 };
    map.set(key, { totalOcc: prev.totalOcc + occ, count: prev.count + 1 });
  }
  return Array.from(map.entries()).map(([key, { totalOcc, count }]) => {
    const [wd, hour] = key.split("-").map(Number);
    return { weekday: wd, weekdayLabel: WEEKDAY_LABELS[wd], hour, avgOcc: totalOcc / count, count };
  });
}

export type OccupancyPeriod = "semana" | "mes" | "trimestre" | "año";

const OCC_MONTH_NAMES: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

function isoWeekStart(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00");
  const dow = (d.getDay() + 6) % 7; // 0=Mon
  d.setDate(d.getDate() - dow);
  return d.toISOString().split("T")[0];
}

/** Clave de agrupación para una fecha (YYYY-MM-DD, ya en calendario Madrid) según el período pedido. */
export function occupancyPeriodKey(dateKey: string, period: OccupancyPeriod): string {
  const [y, m] = dateKey.split("-");
  switch (period) {
    case "semana": return isoWeekStart(dateKey);
    case "mes": return `${y}-${m}`;
    case "trimestre": return `${y}-Q${Math.ceil(parseInt(m) / 3)}`;
    case "año": return y;
  }
}

export function occupancyPeriodLabel(key: string, period: OccupancyPeriod): string {
  switch (period) {
    case "semana": {
      const [, m, d] = key.split("-");
      return `${d}/${m}`;
    }
    case "mes": {
      const [y, m] = key.split("-");
      return `${OCC_MONTH_NAMES[m] ?? m}'${y.slice(2)}`;
    }
    case "trimestre": return key.replace("-", " ");
    case "año": return key;
  }
}

export function occupancyByPeriod(events: MomenceEvent[], period: OccupancyPeriod = "semana") {
  const map = new Map<string, { sold: number; capacity: number }>();
  for (const e of filterActive(events)) {
    const dateKey = new Date(e.dateTime).toLocaleDateString("sv-SE", {
      timeZone: "Europe/Madrid",
    });
    const key = occupancyPeriodKey(dateKey, period);
    const prev = map.get(key) ?? { sold: 0, capacity: 0 };
    map.set(key, { sold: prev.sold + e.ticketsSold, capacity: prev.capacity + e.capacity });
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { sold, capacity }]) => ({
      key,
      label: occupancyPeriodLabel(key, period),
      sold,
      capacity,
      free: capacity - sold,
      occ: capacity > 0 ? sold / capacity : 0,
    }));
}

// ── Ocupación real (Momence v2, class_sessions_v2) ──────────────────────────────
// Mismas formas que occupancyByPeriod/occupancyHeatmap de arriba, pero a partir de asistencia
// real (checkedIn) en vez de reservas (ticketsSold) - sustituyen a esas dos en Analítica ›
// Horario. El fetch (server-only, unstable_cache) vive en lib/occupancyV2.ts; estas funciones
// son puras para poder recalcular el toggle de período en el cliente sin volver a pedir datos.
// Ver [[project-profesoras-v2]].

export type SessionOccRow = {
  starts_at: string;
  teacher_name: string;
  capacity: number;
  booking_count: number;
  checked_in_count: number;
};

export type OccupancyPeriodRowV2 = {
  key: string;
  label: string;
  capacity: number;
  /** Asistencia real (checkedIn) - métrica principal, sustituye a "sold" (reservas). */
  attended: number;
  /** Reservas activas - contexto secundario (demanda), ya no es la métrica principal. */
  reserved: number;
  free: number;
  /** Ocupación REAL: attended / capacity. */
  occ: number;
  /** Ocupación reservada: reserved / capacity (para tooltip - demanda además de quién vino). */
  occReserved: number;
};

export function occupancyByPeriodV2(rows: SessionOccRow[], period: OccupancyPeriod = "semana"): OccupancyPeriodRowV2[] {
  const map = new Map<string, { attended: number; reserved: number; capacity: number }>();
  for (const r of rows) {
    const dateKey = new Date(r.starts_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
    const key = occupancyPeriodKey(dateKey, period);
    const prev = map.get(key) ?? { attended: 0, reserved: 0, capacity: 0 };
    map.set(key, {
      attended: prev.attended + r.checked_in_count,
      reserved: prev.reserved + r.booking_count,
      capacity: prev.capacity + r.capacity,
    });
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { attended, reserved, capacity }]) => ({
      key,
      label: occupancyPeriodLabel(key, period),
      capacity,
      attended,
      reserved,
      free: capacity - attended,
      occ: capacity > 0 ? attended / capacity : 0,
      occReserved: capacity > 0 ? reserved / capacity : 0,
    }));
}

export type OccupancyHeatCellV2 = {
  weekday: number;
  weekdayLabel: string;
  hour: number;
  avgOcc: number;
  avgOccReserved: number;
  count: number;
};

export function occupancyHeatmapV2(rows: SessionOccRow[]): OccupancyHeatCellV2[] {
  const map = new Map<string, { totalOcc: number; totalOccReserved: number; count: number }>();
  for (const r of rows) {
    const { weekday: wd, hour } = madridWeekdayAndHour(r.starts_at);
    const key = `${wd}-${hour}`;
    const occ = r.capacity > 0 ? r.checked_in_count / r.capacity : 0;
    const occReserved = r.capacity > 0 ? r.booking_count / r.capacity : 0;
    const prev = map.get(key) ?? { totalOcc: 0, totalOccReserved: 0, count: 0 };
    map.set(key, { totalOcc: prev.totalOcc + occ, totalOccReserved: prev.totalOccReserved + occReserved, count: prev.count + 1 });
  }
  return Array.from(map.entries()).map(([key, { totalOcc, totalOccReserved, count }]) => {
    const [wd, hour] = key.split("-").map(Number);
    return {
      weekday: wd,
      weekdayLabel: WEEKDAY_LABELS[wd],
      hour,
      avgOcc: totalOcc / count,
      avgOccReserved: totalOccReserved / count,
      count,
    };
  });
}

export function fmt(amount: number) {
  // "es-ES" solo agrupa millares a partir de 5 cifras (quirk de CLDR); "de-DE" usa el
  // mismo separador (punto) pero agrupa siempre a partir de 1000, dando un formato consistente.
  return Math.round(amount).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function pct(rate: number) {
  return `${Math.round(rate * 100)}%`;
}
