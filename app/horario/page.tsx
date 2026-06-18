export const dynamic = "force-dynamic";

import { getEvents, getCustomers } from "@/lib/momence";
import { saveHistoricalEvents, loadHistoricalEvents } from "@/lib/history";
import {
  filterActive,
  filterUpcoming,
} from "@/lib/analytics";
import { loadSales, salesByProduct, urbanBookingsByHour, urbanBookingsByWeekday } from "@/lib/sales";
import HorarioShell from "./HorarioShell";

function getMondayFromParam(week: string | null): Date {
  if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
    const d = new Date(week + "T00:00:00");
    if (!isNaN(d.getTime())) return d;
  }
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
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

export default async function Horario({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string; tab?: string; period?: string; from?: string; to?: string; compareWith?: string; compareFrom?: string; compareTo?: string }>;
}) {
  const params = await searchParams;
  const monday = getMondayFromParam(params.week ?? null);
  const sunday = new Date(monday.getTime() + 7 * 86400000 - 1);

  const [liveEvents, historicalEvents, customers] = await Promise.all([
    getEvents(),
    loadHistoricalEvents(),
    getCustomers(),
  ]);
  await saveHistoricalEvents(liveEvents);

  // Merge historical + live for analytics
  const allById = new Map(historicalEvents.map((e) => [e.id, e]));
  liveEvents.forEach((e) => allById.set(e.id, e));
  const allEvents = Array.from(allById.values());

  // Current week events (for schedule tab)
  const active = filterActive(allEvents);
  const weekEvents = active.filter((e) => {
    const d = new Date(e.dateTime);
    return d >= monday && d <= sunday;
  });

  // ── Period params (for análisis tab) ─────────────────────────────────────────
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const periodParam  = typeof params.period      === "string" ? params.period      : "30";
  const customFrom   = typeof params.from        === "string" ? params.from        : "";
  const customTo     = typeof params.to          === "string" ? params.to          : "";
  const compareParam = typeof params.compareWith === "string" ? params.compareWith : "previous";
  const cpFrom       = typeof params.compareFrom === "string" ? params.compareFrom : "";
  const cpTo         = typeof params.compareTo   === "string" ? params.compareTo   : "";

  let mainFrom: string;
  let mainTo: string = todayStr;
  if (periodParam === "custom" && customFrom && customTo) {
    mainFrom = customFrom;
    mainTo   = customTo;
  } else {
    const days = periodParam === "7" ? 7 : periodParam === "90" ? 90 : 30;
    mainFrom = addDays(todayStr, -days);
  }

  let compFrom: string;
  let compTo: string;
  if (compareParam === "custom" && cpFrom && cpTo) {
    compFrom = cpFrom;
    compTo   = cpTo;
  } else {
    const duration = daysBetween(mainFrom, mainTo);
    compTo   = addDays(mainFrom, -1);
    compFrom = addDays(compTo, -duration);
  }

  const periodLabel =
    periodParam === "7"  ? "7 días"  :
    periodParam === "30" ? "30 días" :
    periodParam === "90" ? "90 días" :
    `${fmtShort(mainFrom)}–${fmtShort(mainTo)}`;

  // Reporting data (for análisis tab)
  const mainEvents = filterActive(allEvents).filter((e) => {
    const d = new Date(e.dateTime);
    return d >= new Date(mainFrom + "T00:00:00") && d <= new Date(mainTo + "T23:59:59");
  });
  const compareEvents = filterActive(allEvents).filter((e) => {
    const d = new Date(e.dateTime);
    return d >= new Date(compFrom + "T00:00:00") && d <= new Date(compTo + "T23:59:59");
  });
  const upcoming7 = filterUpcoming(allEvents, 7);

  const sales = loadSales();
  const topProducts = salesByProduct(sales)
    .filter((p) => p.item !== "Urban")
    .slice(0, 5);
  const uscByHour    = urbanBookingsByHour();
  const uscByWeekday = urbanBookingsByWeekday();

  // Active subscribers by membership (not frozen)
  const membershipMap = new Map<string, { count: number; type: "subscription" | "package-events" }>();
  for (const customer of customers) {
    for (const sub of customer.activeSubscriptions) {
      if (sub.isFreezed) continue;
      const name = sub.membership.name;
      const existing = membershipMap.get(name);
      if (existing) existing.count++;
      else membershipMap.set(name, { count: 1, type: sub.type });
    }
  }
  const activeByMembership = [...membershipMap.entries()]
    .map(([name, { count, type }]) => ({ name, count, type }))
    .sort((a, b) => b.count - a.count);

  const weekMonday  = monday.toISOString().split("T")[0];
  const initialView = params.view === "calendario" ? "calendario" : "lista";
  const initialTab  = params.tab === "analisis" ? "analisis" : "horario";

  return (
    <HorarioShell
      events={weekEvents}
      weekMonday={weekMonday}
      initialView={initialView as "lista" | "calendario"}
      initialTab={initialTab as "horario" | "analisis"}
      reportingData={{ main: mainEvents, compare: compareEvents, upcoming7, periodLabel, topProducts, uscByHour, uscByWeekday, activeByMembership, totalCustomers: customers.length }}
    />
  );
}
