import { getEvents } from "@/lib/momence";
import { saveHistoricalEvents, loadHistoricalEvents } from "@/lib/history";
import {
  filterPast,
  filterPrevious,
  filterUpcoming,
  fmt,
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
  const upcoming = filterUpcoming(events, 7);
  const pastWeek = filterPast(events, 7);

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
    <main className="max-w-5xl mx-auto px-6 py-10">
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
    </main>
  );
}

function TrendBadge({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={`text-xs font-medium shrink-0 ${up ? "text-success" : "text-danger"}`}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(value))}%
    </span>
  );
}
