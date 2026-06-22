import { MomenceEvent } from "@/lib/momence";
import type { BusinessEvent } from "@/lib/businessEvents";
import {
  occupancyRate,
  occupancyByHour,
  occupancyByTeacher,
  occupancyHeatmap,
  totalStudents,
  trend,
  pct,
} from "@/lib/analytics";
import QuestionHeader from "@/app/components/QuestionHeader";
import HorarioOcupacionEvolucion from "./HorarioOcupacionEvolucion";

export type ReportingData = {
  main: MomenceEvent[];
  compare: MomenceEvent[];
  periodLabel: string;
  periodFrom: string;
  periodTo: string;
  uscByHour: Array<{ hour: number; label: string; count: number }>;
  uscByWeekday: Array<{ weekday: number; label: string; count: number }>;
  businessEvents: BusinessEvent[];
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

function occTone(value: number) {
  if (value >= 0.75) return { soft: "bg-success/15 text-success", solid: "bg-success" };
  if (value >= 0.5)  return { soft: "bg-warning/15 text-warning", solid: "bg-warning" };
  return { soft: "bg-danger/15 text-danger", solid: "bg-danger" };
}

function Tooltip({ text, children, as: As = "span", className = "" }: {
  text: string; children: React.ReactNode; as?: "span" | "div"; className?: string;
}) {
  return (
    <As className={`relative inline-flex group ${className}`}>
      {children}
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-20 hidden group-hover:block whitespace-nowrap rounded bg-navy text-white text-[11px] px-2 py-1 shadow-lg">
        {text}
      </span>
    </As>
  );
}

const WEEKDAY_SHORT = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

function fmtD(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

export default function HorarioReporting({ data }: { data: ReportingData }) {
  const { main, compare, periodLabel, periodFrom, periodTo, uscByHour, uscByWeekday, businessEvents } = data;
  const dateRange = `${fmtD(periodFrom)} – ${fmtD(periodTo)}`;

  const occ     = occupancyRate(main);
  const occPrev = occupancyRate(compare);
  const byTeacher  = occupancyByTeacher(main);
  const byHour     = occupancyByHour(main);
  const heatmap    = occupancyHeatmap(main);
  const heatmapHours = [...new Set(heatmap.map((c) => c.hour))].sort((a, b) => a - b);
  const heatCell = (wd: number, hour: number) => heatmap.find((c) => c.weekday === wd && c.hour === hour);
  const heatDayAvg = (wd: number) => {
    const cells = heatmap.filter((c) => c.weekday === wd);
    const count = cells.reduce((s, c) => s + c.count, 0);
    return count > 0 ? { avgOcc: cells.reduce((s, c) => s + c.avgOcc * c.count, 0) / count, count } : null;
  };
  const heatHourAvg = (hour: number) => {
    const cells = heatmap.filter((c) => c.hour === hour);
    const count = cells.reduce((s, c) => s + c.count, 0);
    return count > 0 ? { avgOcc: cells.reduce((s, c) => s + c.avgOcc * c.count, 0) / count, count } : null;
  };

  const maxTeacherOcc = Math.max(...byTeacher.map((r) => r.avgOcc), 0.01);
  const maxHourOcc    = Math.max(...byHour.map((r) => r.avgOcc), 0.01);
  const uscTotal      = uscByHour.reduce((s, r) => s + r.count, 0);
  const maxUscHour    = Math.max(...uscByHour.map((r) => r.count), 1);
  const maxUscWeekday = Math.max(...uscByWeekday.map((r) => r.count), 1);

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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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

      {/* ── Análisis de ocupación ── */}
      <section id="q2">
        <QuestionHeader num={2} question="¿Cómo se reparte la ocupación?" />
        <div className="space-y-4">

          {/* Evolución de la ocupación */}
          <HorarioOcupacionEvolucion events={main} businessEvents={businessEvents} />

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
                      {heatmapHours.map((h) => {
                        const hourAvg = heatHourAvg(h);
                        return (
                          <th key={h} className="text-[11px] font-medium text-navy/55 text-center pb-2 px-1 min-w-[56px]">
                            <div className="flex flex-col items-center gap-1">
                              <span>{String(h).padStart(2, "0")}h</span>
                              {hourAvg !== null && (
                                <Tooltip text={`Media ${String(h).padStart(2, "0")}h: ${hourAvg.count} clases impartidas`}>
                                  <span className={`inline-block rounded-full text-[10px] font-semibold px-1.5 py-0.5 tabular-nums cursor-default ${occTone(hourAvg.avgOcc).soft}`}>
                                    {pct(hourAvg.avgOcc)}
                                  </span>
                                </Tooltip>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4].map((wd) => {
                      const dayAvg = heatDayAvg(wd);
                      return (
                      <tr key={wd}>
                        <td className="text-xs text-navy/50 pr-3 py-1 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{WEEKDAY_SHORT[wd]}</span>
                            {dayAvg !== null && (
                              <Tooltip text={`Media ${WEEKDAY_SHORT[wd]}: ${dayAvg.count} clases impartidas`}>
                                <span className={`inline-block rounded-full text-[10px] font-semibold px-1.5 py-0.5 tabular-nums cursor-default ${occTone(dayAvg.avgOcc).soft}`}>
                                  {pct(dayAvg.avgOcc)}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        {heatmapHours.map((h) => {
                          const cell = heatCell(wd, h);
                          if (!cell) return (
                            <td key={h} className="px-1 py-1">
                              <div className="text-center text-[11px] text-navy/50 py-2 px-2">—</div>
                            </td>
                          );
                          return (
                            <td key={h} className="px-1 py-1">
                              <Tooltip
                                as="div"
                                className="!flex w-full"
                                text={`${WEEKDAY_SHORT[wd]} ${String(h).padStart(2, "0")}h: ${cell.count} clases impartidas`}
                              >
                                <div className={`w-full rounded text-center text-[11px] font-semibold py-2 px-2 text-white ${occTone(cell.avgOcc).solid}`}>
                                  {pct(cell.avgOcc)}
                                </div>
                              </Tooltip>
                            </td>
                          );
                        })}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

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
