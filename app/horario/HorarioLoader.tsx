import { getEvents } from "@/lib/momence";
import { getWaitlistCountsV2 } from "@/lib/momenceV2";
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

  // Lista de espera (API v2, en vivo) para las clases futuras de la semana llenas o casi llenas
  // (≤2 plazas libres: son las únicas donde puede haber cola). El dato solo existe en el detalle
  // de cada sesión, así que se limita a esas pocas para no encarecer la carga. Si la v2 falla,
  // el Horario se muestra igual, sin el dato.
  const now = Date.now();
  const waitlistCandidates = weekEvents.filter(
    (e) => new Date(e.dateTime).getTime() > now && e.capacity > 0 && e.spotsRemaining <= 2,
  );
  if (waitlistCandidates.length > 0) {
    const counts = await getWaitlistCountsV2(waitlistCandidates.map((e) => e.id)).catch(
      () => new Map<number, number>(),
    );
    for (const e of waitlistCandidates) {
      const w = counts.get(e.id);
      if (w != null) e.waitlistCount = w;
    }
  }
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
