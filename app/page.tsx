import { getEvents } from "@/lib/momence";
import { saveHistoricalEvents, loadHistoricalEvents } from "@/lib/history";
import {
  filterPast,
  filterPrevious,
  filterToday,
  filterUpcoming,
  fmt,
  groupByDay,
  occupancyRate,
  pct,
  totalRevenue,
  totalStudents,
  trend,
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
  const prev = filterPrevious(events, 30);
  const today = filterToday(events).sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );
  const upcoming = filterUpcoming(events, 7);
  const pastWeek = filterPast(events, 7);
  const upcomingDays = groupByDay(upcoming);

  const revenueTrend = trend(totalRevenue(past), totalRevenue(prev));
  const studentsTrend = trend(totalStudents(past), totalStudents(prev));
  const occupancyTrend = trend(occupancyRate(past), occupancyRate(prev));
  const projectedTrend = trend(totalRevenue(upcoming), totalRevenue(pastWeek));

  const occ = occupancyRate(past);

  const kpis = [
    {
      label: "Ingresos (30 días)",
      value: fmt(totalRevenue(past)),
      sub: `${past.length} clases impartidas`,
      trend: revenueTrend,
      colorMode: "trend" as const,
    },
    {
      label: "Alumnos (30 días)",
      value: totalStudents(past).toString(),
      sub: `Media ${past.length > 0 ? (totalStudents(past) / past.length).toFixed(1) : 0} por clase`,
      trend: studentsTrend,
      colorMode: "trend" as const,
    },
    {
      label: "Ocupación (30 días)",
      value: pct(occ),
      sub: `Capacidad máx. ${past.reduce((s, e) => s + e.capacity, 0)} plazas`,
      trend: occupancyTrend,
      colorMode: "occupancy" as const,
      occupancy: occ,
    },
    {
      label: "Ingresos proyectados (7 días)",
      value: fmt(totalRevenue(upcoming)),
      sub: `${totalStudents(upcoming)} plazas reservadas`,
      trend: projectedTrend,
      colorMode: "trend" as const,
    },
  ];

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => {
          const valueColor =
            k.colorMode === "occupancy"
              ? k.occupancy! >= 0.7
                ? "text-success"
                : k.occupancy! >= 0.5
                ? "text-warning"
                : "text-danger"
              : "text-navy";
          return (
            <div
              key={k.label}
              className="bg-white border border-navy/10 rounded shadow-card p-5"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs text-navy/40 uppercase tracking-wider leading-tight">{k.label}</p>
                {k.trend !== null && <TrendBadge value={k.trend} />}
              </div>
              <p className={`text-2xl font-semibold ${valueColor}`}>{k.value}</p>
              <p className="text-xs text-navy/40 mt-1">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Hoy */}
      <section>
        <h2 className="text-xs font-semibold text-navy/40 uppercase tracking-widest mb-4">
          Hoy — {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        {today.length === 0 ? (
          <p className="text-sm text-navy/40">No hay clases programadas hoy.</p>
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
                  className="bg-white border border-navy/10 rounded shadow-card px-5 py-4 flex items-center gap-5"
                >
                  <span className="text-sm font-mono text-navy/40 w-11 shrink-0">
                    {time}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy">
                      {e.title}
                    </p>
                    <p className="text-xs text-navy/40">{e.teacher}</p>
                  </div>
                  <OccupancyBar value={occ} />
                  <span className="text-sm text-navy/60 w-16 text-right font-mono">
                    {e.ticketsSold}/{e.capacity}
                  </span>
                  <span className="text-sm font-medium text-navy w-16 text-right">
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
        <h2 className="text-xs font-semibold text-navy/40 uppercase tracking-widest mb-4">
          Próximos 7 días
        </h2>
        {upcomingDays.length === 0 ? (
          <p className="text-sm text-navy/40">No hay clases próximas.</p>
        ) : (
          <div className="space-y-8">
            {upcomingDays.map(({ dateKey, label, events: dayEvents }) => {
              const dayRevenue = totalRevenue(dayEvents);
              const dayOcc = occupancyRate(dayEvents);
              return (
                <div key={dateKey}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-navy/40 uppercase tracking-widest capitalize">
                      {label}
                    </h3>
                    <span className="text-xs text-navy/40">
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
                          className="bg-white border border-navy/10 rounded shadow-card px-5 py-3 flex items-center gap-5"
                        >
                          <span className="text-sm font-mono text-navy/40 w-11 shrink-0">
                            {time}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-navy">
                              {e.title}
                            </p>
                            <p className="text-xs text-navy/40">{e.teacher}</p>
                          </div>
                          <OccupancyBar value={occ} />
                          <span className="text-sm text-navy/60 w-16 text-right font-mono">
                            {e.ticketsSold}/{e.capacity}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded w-20 text-center ${
                              isFull
                                ? "bg-income/10 text-income"
                                : "bg-navy/5 text-navy/50"
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

function TrendBadge({ value }: { value: number }) {
  const up = value >= 0;
  const label = `${up ? "▲" : "▼"} ${Math.abs(Math.round(value))}%`;
  return (
    <span
      className={`text-xs font-medium shrink-0 ${
        up ? "text-success" : "text-danger"
      }`}
    >
      {label}
    </span>
  );
}

function OccupancyBar({ value }: { value: number }) {
  const pctVal = Math.round(value * 100);
  const color =
    pctVal >= 80
      ? "bg-success"
      : pctVal >= 50
      ? "bg-warning"
      : "bg-navy/10";
  return (
    <div className="w-24 h-1.5 bg-navy/5 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${pctVal}%` }}
      />
    </div>
  );
}
