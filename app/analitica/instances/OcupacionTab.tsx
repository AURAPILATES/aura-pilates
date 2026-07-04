import { getEvents } from "@/lib/momence";
import { saveHistoricalEvents, loadHistoricalEvents } from "@/lib/history";
import { filterActive } from "@/lib/analytics";
import { urbanBookingsByHour, urbanBookingsByWeekday } from "@/lib/sales";
import { resolvePeriod, type PeriodSearchParams } from "@/lib/periodCalculation";
import type { BusinessEvent } from "@/lib/businessEvents";
import ClientesFilterBar from "@/app/clientes/ClientesFilterBar";
import HorarioReporting from "./HorarioReporting";

export default async function OcupacionTab({
  searchParams,
  businessEvents,
}: {
  searchParams: PeriodSearchParams;
  businessEvents: BusinessEvent[];
}) {
  const { from: mainFrom, to: mainTo, compFrom, compTo, periodLabel } = resolvePeriod(searchParams, {
    paramPrefix: "oc",
    defaultPeriod: "30",
  });

  const [liveEvents, historicalEvents] = await Promise.all([
    getEvents(),
    loadHistoricalEvents(),
  ]);
  await saveHistoricalEvents(liveEvents);

  const allById = new Map(historicalEvents.map((e) => [e.id, e]));
  liveEvents.forEach((e) => allById.set(e.id, e));
  const allEvents = Array.from(allById.values());

  const mainEvents = filterActive(allEvents).filter((e) => {
    const d = new Date(e.dateTime);
    return d >= new Date(mainFrom + "T00:00:00") && d <= new Date(mainTo + "T23:59:59");
  });
  const compareEvents = filterActive(allEvents).filter((e) => {
    const d = new Date(e.dateTime);
    return d >= new Date(compFrom + "T00:00:00") && d <= new Date(compTo + "T23:59:59");
  });

  const uscByHour = urbanBookingsByHour();
  const uscByWeekday = urbanBookingsByWeekday();

  return (
    <div>
      <ClientesFilterBar defaultPeriod="30" paramPrefix="oc" />
      <HorarioReporting
        data={{
          main: mainEvents,
          compare: compareEvents,
          periodLabel,
          periodFrom: mainFrom,
          periodTo: mainTo,
          uscByHour,
          uscByWeekday,
          businessEvents,
        }}
      />
    </div>
  );
}
