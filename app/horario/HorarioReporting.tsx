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
  past30: MomenceEvent[];
  prev30: MomenceEvent[];
  upcoming7: MomenceEvent[];
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
    <div className={`bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5 ${className}`}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-navy/55 uppercase tracking-wider mb-3">{children}</p>;
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

export default function HorarioReporting({ data }: { data: ReportingData }) {
  const { past30, prev30, upcoming7, topProducts, uscByHour, uscByWeekday } = data;

  const occ     = occupancyRate(past30);
  const occPrev = occupancyRate(prev30);
  const byTeacher  = occupancyByTeacher(past30);
  const byWeekday  = occupancyByWeekday(past30);
  const byHour     = occupancyByHour(past30);
  const heatmap    = occupancyHeatmap(past30);
  const heatmapHours = [...new Set(heatmap.map((c) => c.hour))].sort((a, b) => a - b);
  const heatCell = (wd: number, hour: number) => heatmap.find((c) => c.weekday === wd && c.hour === hour);

  const maxTeacherOcc = Math.max(...byTeacher.map((r) => r.avgOcc), 0.01);
  const maxWeekdayOcc = Math.max(...byWeekday.map((r) => r.avgOcc), 0.01);
  const maxHourOcc    = Math.max(...byHour.map((r) => r.avgOcc), 0.01);
  const uscTotal      = uscByHour.reduce((s, r) => s + r.count, 0);
  const maxUscHour    = Math.max(...uscByHour.map((r) => r.count), 1);
  const maxUscWeekday = Math.max(...uscByWeekday.map((r) => r.count), 1);

  const totalRev = topProducts.reduce((s, p) => s + p.revenue, 0);

  // Baja asistencia próximos 7 días
  const lowOcc = upcoming7
    .filter((e) => e.capacity > 0 && e.ticketsSold / e.capacity < 0.4)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .slice(0, 5);

  // Top clases (30d, ≥2 sesiones)
  const classByTitle = new Map<string, { total: number; count: number }>();
  for (const e of past30) {
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
        <QuestionHeader num={1} question="¿Cómo fue el rendimiento de los últimos 30 días?" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: "Clases impartidas",
              value: past30.length.toString(),
              sub: `${totalStudents(past30)} alumnos en total`,
              trendVal: trend(past30.length, prev30.length),
            },
            {
              label: "Alumnos",
              value: totalStudents(past30).toString(),
              sub: `Media ${past30.length > 0 ? (totalStudents(past30) / past30.length).toFixed(1) : 0} por clase`,
              trendVal: trend(totalStudents(past30), totalStudents(prev30)),
            },
            {
              label: "Ocupación media",
              value: pct(occ),
              sub: `${past30.reduce((s, e) => s + e.capacity, 0)} plazas totales`,
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
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs text-navy/55 uppercase tracking-wider leading-tight">{k.label}</p>
                <TrendBadge value={k.trendVal ?? null} />
              </div>
              <p className={`text-2xl font-semibold ${k.valueColor ?? "text-navy"}`}>{k.value}</p>
              <p className="text-xs text-navy/55 mt-1">{k.sub}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Alertas + Oportunidades ── */}
      <section id="q2">
        <QuestionHeader num={2} question="¿Qué clases hay que rellenar esta semana?" />
        {lowOcc.length === 0 ? (
          <Card>
            <div className="flex items-center gap-2 text-success text-sm">
              <span className="text-base">✓</span>
              <span>Todas las clases próximas tienen buena cobertura</span>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lowOcc.map((e) => {
              const fillRate = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
              return (
                <Card key={e.id}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-navy truncate max-w-[160px]">{e.title}</p>
                    <span className="text-xs text-danger font-semibold tabular-nums shrink-0">{e.ticketsSold}/{e.capacity}</span>
                  </div>
                  <OccBar value={fillRate} />
                  <p className="text-[11px] text-navy/50 mt-1.5">{fmtDate(e.dateTime)} · {e.teacher}</p>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Oportunidades ── */}
      <section id="q3">
        <QuestionHeader num={3} question="¿Qué está funcionando mejor?" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardTitle>Clases más demandadas</CardTitle>
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
      <section id="q4">
        <QuestionHeader num={4} question="¿Cómo se reparte la ocupación?" />
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

          {/* Profesora + Día de la semana */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardTitle>Por profesora</CardTitle>
              <div className="space-y-3">
                {byTeacher.map((r) => {
                  const w = maxTeacherOcc > 0 ? (r.avgOcc / maxTeacherOcc) * 100 : 0;
                  const barColor = r.avgOcc >= 0.75 ? "bg-success" : r.avgOcc >= 0.5 ? "bg-warning" : "bg-danger";
                  const textColor = r.avgOcc >= 0.75 ? "text-success" : r.avgOcc >= 0.5 ? "text-warning" : "text-danger";
                  return (
                    <div key={r.teacher} className="flex items-center gap-3">
                      <span className="text-sm text-navy w-32 shrink-0 truncate">{r.teacher}</span>
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
                    <p className="text-[11px] text-navy/55 uppercase tracking-wider mb-2">Por franja</p>
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
                    <p className="text-[11px] text-navy/55 uppercase tracking-wider mb-2">Por día</p>
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
