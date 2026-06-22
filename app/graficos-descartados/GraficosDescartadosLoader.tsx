import { getEvents } from "@/lib/momence";
import { saveHistoricalEvents, loadHistoricalEvents } from "@/lib/history";
import { filterActive } from "@/lib/analytics";
import GraficosDescartados from "./GraficosDescartados";

type Props = { from: string; to: string; periodLabel: string };

export default async function GraficosDescartadosLoader({ from, to, periodLabel }: Props) {
  const [liveEvents, historicalEvents] = await Promise.all([
    getEvents(),
    loadHistoricalEvents(),
  ]);
  await saveHistoricalEvents(liveEvents);

  const allById = new Map(historicalEvents.map((e) => [e.id, e]));
  liveEvents.forEach((e) => allById.set(e.id, e));
  const allEvents = Array.from(allById.values());

  const main = filterActive(allEvents).filter((e) => {
    const d = new Date(e.dateTime);
    return d >= new Date(from + "T00:00:00") && d <= new Date(to + "T23:59:59");
  });

  return <GraficosDescartados events={main} periodLabel={periodLabel} from={from} to={to} />;
}
