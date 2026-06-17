export const dynamic = "force-dynamic";

import { getEvents, getCustomers } from "@/lib/momence";
import { saveHistoricalEvents, loadHistoricalEvents } from "@/lib/history";
import {
  filterActive,
  filterPast,
  filterPrevious,
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

export default async function Horario({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string; tab?: string }>;
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

  // Reporting data (for análisis tab)
  const past30   = filterPast(allEvents, 30);
  const prev30   = filterPrevious(allEvents, 30);
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
      reportingData={{ past30, prev30, upcoming7, topProducts, uscByHour, uscByWeekday, activeByMembership }}
    />
  );
}
