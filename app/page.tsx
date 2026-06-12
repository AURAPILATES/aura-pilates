import { getEvents } from "@/lib/momence";
import { saveHistoricalEvents, loadHistoricalEvents } from "@/lib/history";
import {
  filterPast,
  filterToday,
  filterUpcoming,
  fmt,
  groupByDay,
  occupancyRate,
  pct,
  totalRevenue,
  totalStudents,
} from "@/lib/analytics";

export default async function Dashboard() {
  const [liveEvents, historicalEvents] = await Promise.all([
    getEvents(),
    loadHistoricalEvents(),
  ]);
  await saveHistoricalEvents(liveEvents);

  const allById = new Map(historicalEvents.map((e) => [e.id, e]));
  liveEvents.forEach((e) => allById.set(e.id, e));
  const events = Array.from(allById.values());

  const past = filterPast(events, 30);
  const today = filterToday(events).sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );
  const upcoming = filterUpcoming(events, 7);
  const upcomingDays = groupByDay(upcoming);

  const kpis = [
    {
      label: "Ingresos (30 días)",
      value: fmt(totalRevenue(past)),
      sub: `${past.length} clases impartidas`,
    },
    {
      label: "Alumnos (30 días)",
      value: totalStudents(past).toString(),
      sub: `Media ${past.length > 0 ? (totalStudents(past) / past.length).toFixed(1) : 0} por clase`,
    },
    {
      label: "Ocupación media (30 días)",
      value: pct(occupancyRate(past)),
      sub: `Capacidad máx. ${past.reduce((s, e) => s + e.capacity, 0)} plazas`,
    },
    {
      label: "Ingresos proyectados (7 días)",
      value: fmt(totalRevenue(upcoming)),
      sub: `${totalStudents(upcoming)} plazas reservadas`,
    },
  ];

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="bg-white border border-stone-200 rounded-xl p-5"
          >
            <p className="text-xs text-stone-400 mb-1">{k.label}</p>
            <p className="text-2xl font-semibold text-stone-900">{k.value}</p>
            <p className="text-xs text-stone-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Hoy */}
      <section>
        <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-4">
          Hoy
        </h2>
        {today.length === 0 ? (
          <p className="text-sm text-stone-400">No hay clases programadas hoy.</p>
        ) : (
          <div className="space-y-2">
            {today.map((e) => {
              const time = new Date(e.dateTime).toLocaleTimeString("es-ES", {
                timeZone: "Europe/Madrid",
                hour: "2-digit",
                minute: "2-digit",
              });
              const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
              return (
                <div
                  key={e.id}
                  className="bg-white border border-stone-200 rounded-xl px-5 py-4 flex items-center gap-5"
                >
                  <span className="text-sm font-mono text-stone-400 w-11 shrink-0">
                    {time}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-900">
                      {e.title}
                    </p>
                    <p className="text-xs text-stone-400">{e.teacher}</p>
                  </div>
                  <OccupancyBar value={occ} />
                  <span className="text-sm text-stone-600 w-16 text-right">
                    {e.ticketsSold}/{e.capacity}
                  </span>
                  <span className="text-sm font-medium text-stone-900 w-16 text-right">
                    {fmt(e.ticketsSold * e.fixedPrice)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Próximos 7 días */}
      <section>
        <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-4">
          Próximos 7 días
        </h2>
        {upcomingDays.length === 0 ? (
          <p className="text-sm text-stone-400">No hay clases próximas.</p>
        ) : (
          <div className="space-y-8">
            {upcomingDays.map(({ dateKey, label, events: dayEvents }) => {
              const dayRevenue = totalRevenue(dayEvents);
              const dayOcc = occupancyRate(dayEvents);
              return (
                <div key={dateKey}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-widest capitalize">
                      {label}
                    </h3>
                    <span className="text-xs text-stone-400">
                      {fmt(dayRevenue)} · {pct(dayOcc)} ocupación
                    </span>
                  </div>
                  <div className="space-y-2">
                    {dayEvents.map((e) => {
                      const time = new Date(e.dateTime).toLocaleTimeString(
                        "es-ES",
                        {
                          timeZone: "Europe/Madrid",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      );
                      const occ =
                        e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
                      const isFull = e.spotsRemaining === 0;
                      return (
                        <div
                          key={e.id}
                          className="bg-white border border-stone-200 rounded-xl px-5 py-3 flex items-center gap-5"
                        >
                          <span className="text-sm font-mono text-stone-400 w-11 shrink-0">
                            {time}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900">
                              {e.title}
                            </p>
                            <p className="text-xs text-stone-400">{e.teacher}</p>
                          </div>
                          <OccupancyBar value={occ} />
                          <span className="text-sm text-stone-600 w-16 text-right">
                            {e.ticketsSold}/{e.capacity}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full w-20 text-center ${
                              isFull
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-stone-100 text-stone-500"
                            }`}
                          >
                            {isFull ? "Llena" : `${e.spotsRemaining} libres`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function OccupancyBar({ value }: { value: number }) {
  const pctVal = Math.round(value * 100);
  const color =
    pctVal >= 80
      ? "bg-emerald-500"
      : pctVal >= 50
      ? "bg-amber-400"
      : "bg-stone-200";
  return (
    <div className="w-24 h-1.5 bg-stone-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${pctVal}%` }}
      />
    </div>
  );
}
