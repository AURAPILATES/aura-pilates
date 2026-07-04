import { getEvents } from "@/lib/momence";
import { saveHistoricalEvents, loadHistoricalEvents } from "@/lib/history";
import { filterActive } from "@/lib/analytics";
import HorarioShell from "./HorarioShell";

type Props = {
  weekMonday: string;
  initialView: "lista" | "calendario";
};

export default async function HorarioLoader({ weekMonday, initialView }: Props) {
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
  const hiddenWeekEvents = allEvents.filter((e) => {
    const d = new Date(e.dateTime);
    return d >= monday && d <= sunday && (!e.published || e.isCancelled || e.isDeleted);
  });

  return (
    <HorarioShell
      events={weekEvents}
      hiddenEvents={hiddenWeekEvents}
      weekMonday={weekMonday}
      initialView={initialView}
    />
  );
}
