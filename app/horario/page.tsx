import { getEvents } from "@/lib/momence";
import { filterUpcoming } from "@/lib/analytics";
import HorarioFilters from "./HorarioFilters";

export default async function Horario() {
  const events = await getEvents();
  const upcoming = filterUpcoming(events, 30);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-navy">Horario</h1>
        <span className="text-sm text-navy/55">
          Próximos 30 días · {upcoming.length} clases
        </span>
      </div>
      <HorarioFilters events={upcoming} />
    </main>
  );
}
