import { getEvents } from "@/lib/momence";
import { saveHistoricalEvents, loadHistoricalEvents } from "@/lib/history";
import { filterActive, filterUpcoming } from "@/lib/analytics";
import { loadSales, salesByProduct, filterSalesByDate, urbanBookingsByHour, urbanBookingsByWeekday } from "@/lib/sales";
import HorarioShell from "./HorarioShell";

type Props = {
  weekMonday: string;
  initialView: "lista" | "calendario";
  initialTab: "horario" | "analisis";
  mainFrom: string;
  mainTo: string;
  compFrom: string;
  compTo: string;
  periodLabel: string;
};

export default async function HorarioLoader({
  weekMonday, initialView, initialTab,
  mainFrom, mainTo, compFrom, compTo, periodLabel,
}: Props) {
  const monday = new Date(weekMonday + "T00:00:00");
  const sunday = new Date(monday.getTime() + 7 * 86400000 - 1);

  const [liveEvents, historicalEvents] = await Promise.all([
    getEvents(),
    loadHistoricalEvents(),
  ]);
  await saveHistoricalEvents(liveEvents);

  const allById = new Map(historicalEvents.map((e) => [e.id, e]));
  liveEvents.forEach((e) => allById.set(e.id, e));
  const allEvents = Array.from(allById.values());

  const active = filterActive(allEvents);
  const weekEvents = active.filter((e) => {
    const d = new Date(e.dateTime);
    return d >= monday && d <= sunday;
  });

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
  const topProducts = salesByProduct(filterSalesByDate(sales, mainFrom, mainTo))
    .filter((p) => p.item !== "Urban")
    .slice(0, 5);
  const uscByHour    = urbanBookingsByHour();
  const uscByWeekday = urbanBookingsByWeekday();

  return (
    <HorarioShell
      events={weekEvents}
      weekMonday={weekMonday}
      initialView={initialView}
      initialTab={initialTab}
      reportingData={{
        main: mainEvents,
        compare: compareEvents,
        upcoming7,
        periodLabel,
        periodFrom: mainFrom,
        periodTo: mainTo,
        topProducts,
        uscByHour,
        uscByWeekday,
      }}
    />
  );
}
