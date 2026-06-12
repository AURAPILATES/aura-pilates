import { getEvents } from "@/lib/momence";
import { filterUpcoming, fmt, groupByDay, occupancyRate, pct, totalRevenue } from "@/lib/analytics";

export default async function Horario() {
  const events = await getEvents();
  const upcoming = filterUpcoming(events, 30);
  const days = groupByDay(upcoming);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">Horario</h1>
        <span className="text-sm text-stone-400">
          Próximos 30 días · {upcoming.length} clases
        </span>
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-stone-400">No hay clases programadas.</p>
      ) : (
        <div className="space-y-10">
          {days.map(({ dateKey, label, events: dayEvents }) => (
            <div key={dateKey}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest capitalize">
                  {label}
                </h2>
                <span className="text-xs text-stone-400">
                  {fmt(totalRevenue(dayEvents))} · {pct(occupancyRate(dayEvents))} ocupación
                </span>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-xs text-stone-400">
                      <th className="text-left px-5 py-3 font-medium">Hora</th>
                      <th className="text-left px-4 py-3 font-medium">Clase</th>
                      <th className="text-left px-4 py-3 font-medium">Instructora</th>
                      <th className="text-center px-4 py-3 font-medium">Ocupación</th>
                      <th className="text-center px-4 py-3 font-medium">Plazas</th>
                      <th className="text-right px-5 py-3 font-medium">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayEvents.map((e, i) => {
                      const time = new Date(e.dateTime).toLocaleTimeString("es-ES", {
                        timeZone: "Europe/Madrid",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const occ = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
                      const isFull = e.spotsRemaining === 0;
                      return (
                        <tr
                          key={e.id}
                          className={`${i < dayEvents.length - 1 ? "border-b border-stone-100" : ""}`}
                        >
                          <td className="px-5 py-3.5 font-mono text-stone-500">{time}</td>
                          <td className="px-4 py-3.5 font-medium text-stone-900">{e.title}</td>
                          <td className="px-4 py-3.5 text-stone-500">{e.teacher}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    occ >= 0.8 ? "bg-emerald-500" : occ >= 0.5 ? "bg-amber-400" : "bg-stone-300"
                                  }`}
                                  style={{ width: `${Math.round(occ * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-stone-400 w-8">{pct(occ)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                isFull
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-stone-100 text-stone-500"
                              }`}
                            >
                              {isFull ? "Llena" : `${e.spotsRemaining}/${e.capacity}`}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-medium text-stone-900">
                            {fmt(e.ticketsSold * e.fixedPrice)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-stone-100 bg-stone-50">
                      <td colSpan={5} className="px-5 py-3 text-xs text-stone-400">
                        {dayEvents.length} clases · {dayEvents.reduce((s, e) => s + e.ticketsSold, 0)} alumnos
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-semibold text-stone-900">
                        {fmt(totalRevenue(dayEvents))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
