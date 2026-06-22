import { MomenceEvent } from "@/lib/momence";
import { occupancyByHour, occupancyByWeekday, pct } from "@/lib/analytics";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-5">
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-navy/50 uppercase tracking-wider mb-3">{children}</p>;
}

function OccBar({ value }: { value: number }) {
  const color = value >= 0.7 ? "bg-success" : value >= 0.4 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex-1 h-1.5 bg-navy/5 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

function fmtD(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

export default function GraficosDescartados({
  events, periodLabel, from, to,
}: { events: MomenceEvent[]; periodLabel: string; from: string; to: string }) {
  const byHour    = occupancyByHour(events);
  const byWeekday = occupancyByWeekday(events);
  const maxWeekdayOcc = Math.max(...byWeekday.map((r) => r.avgOcc), 0.01);
  const maxHourOcc = Math.max(...byHour.map((r) => r.avgOcc), 0.01);
  const topHours = [...byHour].sort((a, b) => b.avgOcc - a.avgOcc).slice(0, 4);

  const classByTitle = new Map<string, { total: number; count: number }>();
  for (const e of events) {
    if (e.capacity === 0) continue;
    const v = e.ticketsSold / e.capacity;
    const ex = classByTitle.get(e.title) ?? { total: 0, count: 0 };
    classByTitle.set(e.title, { total: ex.total + v, count: ex.count + 1 });
  }
  const topClasses = [...classByTitle.entries()]
    .map(([title, { total, count }]) => ({ title, avgOcc: total / count, count }))
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.avgOcc - a.avgOcc)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <p className="text-xs text-navy/40">Período: {periodLabel} ({fmtD(from)} – {fmtD(to)})</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Mejores franjas horarias</CardTitle>
          {topHours.length === 0 ? (
            <p className="text-sm text-navy/45">Sin datos</p>
          ) : (
            <div className="space-y-3">
              {topHours.map((h) => (
                <div key={h.label} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-navy/60 w-12 shrink-0">{h.label}</span>
                  <OccBar value={h.avgOcc} />
                  <span className={`text-xs font-semibold w-10 text-right tabular-nums ${
                    h.avgOcc >= 0.7 ? "text-success" : h.avgOcc >= 0.4 ? "text-warning" : "text-danger"
                  }`}>{pct(h.avgOcc)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Por clase</CardTitle>
          {topClasses.length === 0 ? (
            <p className="text-sm text-navy/45">Sin datos suficientes</p>
          ) : (
            <div className="space-y-3">
              {topClasses.map((c) => (
                <div key={c.title}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-navy truncate max-w-[160px]">{c.title}</p>
                    <span className="text-xs text-success font-semibold tabular-nums">{pct(c.avgOcc)}</span>
                  </div>
                  <OccBar value={c.avgOcc} />
                  <p className="text-[11px] text-navy/50 mt-0.5">{c.count} sesiones</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Por día de la semana</CardTitle>
          <div className="space-y-3">
            {byWeekday.map((r) => {
              const w = maxWeekdayOcc > 0 ? (r.avgOcc / maxWeekdayOcc) * 100 : 0;
              const barColor = r.avgOcc >= 0.75 ? "bg-success" : r.avgOcc >= 0.5 ? "bg-warning" : "bg-danger";
              const textColor = r.avgOcc >= 0.75 ? "text-success" : r.avgOcc >= 0.5 ? "text-warning" : "text-danger";
              return (
                <div key={r.weekday} className="flex items-center gap-3">
                  <span className="text-sm text-navy w-20 shrink-0">{r.label}</span>
                  <div className="flex-1 h-2 bg-navy/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${w}%` }} />
                  </div>
                  <span className={`text-xs font-semibold w-10 text-right tabular-nums ${textColor}`}>{pct(r.avgOcc)}</span>
                  <span className="text-xs text-navy/45 w-14 text-right tabular-nums shrink-0">{r.count} clases</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardTitle>Por franja horaria</CardTitle>
          <div className="space-y-3">
            {byHour.map((r) => {
              const w = maxHourOcc > 0 ? (r.avgOcc / maxHourOcc) * 100 : 0;
              const barColor = r.avgOcc >= 0.75 ? "bg-success" : r.avgOcc >= 0.5 ? "bg-warning" : "bg-danger";
              const textColor = r.avgOcc >= 0.75 ? "text-success" : r.avgOcc >= 0.5 ? "text-warning" : "text-danger";
              return (
                <div key={r.hour} className="flex items-center gap-3">
                  <span className="text-sm text-navy/60 font-mono w-12 shrink-0">{r.label}</span>
                  <div className="flex-1 h-2 bg-navy/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${w}%` }} />
                  </div>
                  <span className={`text-xs font-semibold w-10 text-right tabular-nums ${textColor}`}>{pct(r.avgOcc)}</span>
                  <span className="text-xs text-navy/45 w-14 text-right tabular-nums shrink-0">{r.count} clases</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
