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

export function fmt(amount: number) {
  return amount.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

export function pct(rate: number) {
  return `${Math.round(rate * 100)}%`;
}
