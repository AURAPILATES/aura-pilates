import { MomenceEvent } from "@/lib/momence";
import {
  occupancyRate,
  occupancyByHour,
  occupancyByTeacher,
  occupancyByWeekday,
  occupancyHeatmap,
  totalStudents,
  trend,
  pct,
} from "@/lib/analytics";
import QuestionHeader from "@/app/components/QuestionHeader";

export type ReportingData = {
  main: MomenceEvent[];
  compare: MomenceEvent[];
  upcoming7: MomenceEvent[];
  periodLabel: string;
  periodFrom: string;
  periodTo: string;
  topProducts: Array<{ item: string; revenue: number; count: number }>;
  uscByHour: Array<{ hour: number; label: string; count: number }>;
  uscByWeekday: Array<{ weekday: number; label: string; count: number }>;
};

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={`text-xs font-medium shrink-0 ${up ? "text-success" : "text-danger"}`}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(value))}%
    </span>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-5 ${className}`}>
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

const WEEKDAY_SHORT = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

function fmtD(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

export default function HorarioReporting({ data }: { data: ReportingData }) {
  const { main, compare, upcoming7, periodLabel, periodFrom, periodTo, topProducts, uscByHour, uscByWeekday } = data;
  const dateRange = `${fmtD(periodFrom)} – ${fmtD(periodTo)}`;

  const occ     = occupancyRate(main);
  const occPrev = occupancyRate(compare);
  const byTeacher  = occupancyByTeacher(main);
  const byWeekday  = occupancyByWeekday(main);
  const byHour     = occupancyByHour(main);
  const heatmap    = occupancyHeatmap(main);
  const heatmapHours = [...new Set(heatmap.map((c) => c.hour))].sort((a, b) => a - b);
  const heatCell = (wd: number, hour: number) => heatmap.find((c) => c.weekday === wd && c.hour === hour);

  const maxTeacherOcc = Math.max(...byTeacher.map((r) => r.avgOcc), 0.01);
  const maxWeekdayOcc = Math.max(...byWeekday.map((r) => r.avgOcc), 0.01);
  const maxHourOcc    = Math.max(...byHour.map((r) => r.avgOcc), 0.01);
  const uscTotal      = uscByHour.reduce((s, r) => s + r.count, 0);
  const maxUscHour    = Math.max(...uscByHour.map((r) => r.count), 1);
  const maxUscWeekday = Math.max(...uscByWeekday.map((r) => r.count), 1);

  const totalRev = topProducts.reduce((s, p) => s + p.revenue, 0);

  // Top clases (período, ≥2 sesiones)
  const classByTitle = new Map<string, { total: number; count: number }>();
  for (const e of main) {
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

  const topHours = [...byHour].sort((a, b) => b.avgOcc - a.avgOcc).slice(0, 4);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  return (
    <div className="space-y-10">

      {/* ── KPIs ── */}
      <section id="q1" className="space-y-4">
        <QuestionHeader num={1} question={`¿Cómo fue el rendimiento de los últimos ${periodLabel}?`} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: "Clases impartidas",
              value: main.length.toString(),
              sub: `${totalStudents(main)} alumnos en total`,
              trendVal: trend(main.length, compare.length),
            },
            {
              label: "Alumnos",
              value: totalStudents(main).toString(),
              sub: `Media ${main.length > 0 ? (totalStudents(main) / main.length).toFixed(1) : 0} por clase`,
              trendVal: trend(totalStudents(main), totalStudents(compare)),
            },
            {
              label: "Ocupación media",
              value: pct(occ),
              sub: `${main.reduce((s, e) => s + e.capacity, 0)} plazas totales`,
              trendVal: trend(occ, occPrev),
              valueColor: occ >= 0.7 ? "text-success" : occ >= 0.4 ? "text-warning" : "text-danger",
            },
            {
              label: "Reservas próx. 7d",
              value: `${totalStudents(upcoming7)}`,
              sub: `${upcoming7.length} clases programadas`,
              trendVal: null,
            },
          ].map((k) => (
            <Card key={k.label}>
              <CardTitle>{k.label}</CardTitle>
              <p className="text-[10px] text-navy/40 -mt-2 mb-2">{dateRange}</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-2xl font-semibold tabular-nums ${k.valueColor ?? "text-navy"}`}>{k.value}</p>
                <TrendBadge value={k.trendVal ?? null} />
              </div>
              <p className="text-[10px] text-navy/40 mt-1.5">{k.sub}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Qué está funcionando mejor ── */}
      <section id="q2">
        <QuestionHeader num={2} question="¿Qué está funcionando mejor?" />
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
            <CardTitle>Productos más vendidos</CardTitle>
            {topProducts.length === 0 ? (
              <p className="text-sm text-navy/45">Sin datos de ventas</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((p) => {
                  const share = totalRev > 0 ? p.revenue / totalRev : 0;
                  return (
                    <div key={p.item}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-navy truncate max-w-[160px]">{p.item}</p>
                        <span className="text-xs font-semibold text-navy/60 tabular-nums">{p.count} ventas</span>
                      </div>
                      <div className="h-1.5 bg-navy/5 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.round(share * 100)}%` }} />
                      </div>
                      <p className="text-[11px] text-navy/50 mt-0.5">{pct(share)} del total</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* ── Análisis de ocupación ── */}
      <section id="q3">
        <QuestionHeader num={3} question="¿Cómo se reparte la ocupación?" />
        <div className="space-y-4">

          {/* Mapa de calor */}
          <Card>
            <CardTitle>Mapa de calor · Día × Hora</CardTitle>
            {heatmap.length === 0 ? (
              <p className="text-sm text-navy/45">Sin datos de clases pasadas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="w-20" />
                      {heatmapHours.map((h) => (
                        <th key={h} className="text-[11px] font-medium text-navy/55 text-center pb-2 px-1 min-w-[56px]">
                          {String(h).padStart(2, "0")}h
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4].map((wd) => (
                      <tr key={wd}>
                        <td className="text-xs text-navy/50 pr-3 py-1 whitespace-nowrap">{WEEKDAY_SHORT[wd]}</td>
                        {heatmapHours.map((h) => {
                          const cell = heatCell(wd, h);
                          if (!cell) return (
                            <td key={h} className="px-1 py-1">
                              <div className="text-center text-[11px] text-navy/50 py-2 px-2">—</div>
                            </td>
                          );
                          const bg = cell.avgOcc >= 0.75 ? "bg-success" : cell.avgOcc >= 0.5 ? "bg-warning" : "bg-danger";
                          return (
                            <td key={h} className="px-1 py-1">
                              <div className={`rounded text-center text-[11px] font-semibold py-2 px-2 text-white ${bg}`}
                                title={`${cell.count} clases`}>
                                {pct(cell.avgOcc)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Por clase + Por día de la semana */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          </div>

          {/* Franja horaria + Urban Sports Club */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            {uscTotal > 0 && (
              <Card>
                <CardTitle>Urban Sports Club · {uscTotal} reservas</CardTitle>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[11px] font-semibold text-navy/50 uppercase tracking-wider mb-2">Por franja</p>
                    <div className="space-y-2">
                      {uscByHour.map((r) => (
                        <div key={r.hour} className="flex items-center gap-2">
                          <span className="text-xs text-navy/50 font-mono w-10 shrink-0">{r.label}</span>
                          <div className="flex-1 h-1.5 bg-navy/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / maxUscHour) * 100}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-navy/50 w-6 text-right">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-navy/50 uppercase tracking-wider mb-2">Por día</p>
                    <div className="space-y-2">
                      {uscByWeekday.map((r) => (
                        <div key={r.weekday} className="flex items-center gap-2">
                          <span className="text-xs text-navy/50 w-14 shrink-0">{r.label}</span>
                          <div className="flex-1 h-1.5 bg-navy/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / maxUscWeekday) * 100}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-navy/50 w-6 text-right">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>

        </div>
      </section>


    </div>
  );
}
