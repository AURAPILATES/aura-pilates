import { getEvents } from "@/lib/momence";
import { saveHistoricalEvents, loadHistoricalEvents } from "@/lib/history";
import {
  filterPast,
  filterPrevious,
  filterUpcoming,
  filterToday,
  occupancyRate,
  pct,
  totalStudents,
  trend,
  occupancyByHour,
  occupancyByTeacher,
  occupancyByWeekday,
  occupancyHeatmap,
} from "@/lib/analytics";
import { loadSales, salesByProduct, urbanBookingsByHour, urbanBookingsByWeekday } from "@/lib/sales";
import { getLatestImportDate } from "@/lib/transactions";
import vacData from "@/data/vacaciones.json";

// ── Helpers ───────────────────────────────────────────────────────────────────

function TrendBadge({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={`text-xs font-medium shrink-0 ${up ? "text-success" : "text-danger"}`}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(value))}%
    </span>
  );
}

function SectionHeader({
  title,
  subtitle,
  accent,
}: {
  title: string;
  subtitle?: string;
  accent: "primary" | "warning" | "success";
}) {
  const bar = { primary: "bg-primary", warning: "bg-warning", success: "bg-success" }[accent];
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-1 h-5 rounded-full ${bar}`} />
      <div>
        <h2 className="text-xs font-semibold text-navy/60 uppercase tracking-widest">{title}</h2>
        {subtitle && <p className="text-[11px] text-navy/45 mt-0.5">{subtitle}</p>}
      </div>
    </div>
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-success text-sm">
      <span className="text-base">✓</span>
      <span>{label}</span>
    </div>
  );
}

function OccBar({ value }: { value: number }) {
  const color = value >= 0.7 ? "bg-success" : value >= 0.4 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex-1 h-1.5 bg-navy/5 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function Dashboard() {
  const [liveEvents, historicalEvents, latestBankImport] = await Promise.all([
    getEvents(),
    loadHistoricalEvents(),
    getLatestImportDate(),
  ]);
  await saveHistoricalEvents(liveEvents);

  const allById = new Map(historicalEvents.map((e) => [e.id, e]));
  liveEvents.forEach((e) => allById.set(e.id, e));
  const events = Array.from(allById.values());

  const past        = filterPast(events, 30);
  const prev        = filterPrevious(events, 30);
  const upcoming    = filterUpcoming(events, 7);
  const pastWeek    = filterPast(events, 7);
  const todayEvents = filterToday(events).sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime(),
  );

  const occ = occupancyRate(past);

  // ── KPIs (solo métricas operativas — el dinero está en Finanzas) ──
  const kpis = [
    {
      label: "Clases (30 días)",
      value: past.length.toString(),
      sub: `${totalStudents(past)} alumnos en total`,
      trend: trend(past.length, prev.length),
      colorMode: "trend" as const,
    },
    {
      label: "Alumnos (30 días)",
      value: totalStudents(past).toString(),
      sub: `Media ${past.length > 0 ? (totalStudents(past) / past.length).toFixed(1) : 0} por clase`,
      trend: trend(totalStudents(past), totalStudents(prev)),
      colorMode: "trend" as const,
    },
    {
      label: "Ocupación (30 días)",
      value: pct(occ),
      sub: `${past.reduce((s, e) => s + e.capacity, 0)} plazas totales`,
      trend: trend(occupancyRate(past), occupancyRate(prev)),
      colorMode: "occupancy" as const,
      occupancy: occ,
    },
    {
      label: "Próximos 7 días",
      value: `${totalStudents(upcoming)} reservas`,
      sub: `${upcoming.length} clases programadas`,
      trend: trend(totalStudents(upcoming), totalStudents(pastWeek)),
      colorMode: "trend" as const,
    },
  ];

  // ── Alertas ──

  // 1. Clases con baja asistencia (próximos 7 días, < 40%)
  const lowOccUpcoming = upcoming
    .filter((e) => e.capacity > 0 && e.ticketsSold / e.capacity < 0.4)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    .slice(0, 4);

  // 2. Vacaciones pendientes de planificar
  const pendingVac = (vacData.personas as { nombre: string; diasTotales: number; vacaciones: string[] }[])
    .map((p) => ({ nombre: p.nombre, pendientes: p.diasTotales - p.vacaciones.length }))
    .filter((p) => p.pendientes > 0)
    .sort((a, b) => b.pendientes - a.pendientes);

  // 3. Próxima obligación fiscal
  const today = new Date();
  const daysUntil = (d: string) =>
    Math.ceil((new Date(d).getTime() - today.getTime()) / 86_400_000);
  const obligations = [
    { label: "IVA T2",         date: "20 jul", deadline: "2026-07-20" },
    { label: "IRPF T2",        date: "20 jul", deadline: "2026-07-20" },
    { label: "IVA T3",         date: "20 oct", deadline: "2026-10-20" },
    { label: "IRPF T3",        date: "20 oct", deadline: "2026-10-20" },
    { label: "IVA T4 / Anual", date: "20 ene", deadline: "2027-01-20" },
  ];
  const nextObligation = obligations
    .filter((o) => daysUntil(o.deadline) >= 0)
    .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))[0];

  // ── Oportunidades ──

  // 1. Clases más demandadas (past 30d, ≥ 2 sesiones)
  const classByTitle = new Map<string, { total: number; count: number }>();
  for (const e of past) {
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

  // 2. Mejores franjas horarias
  const byHour = occupancyByHour(past);
  const topHours = [...byHour].sort((a, b) => b.avgOcc - a.avgOcc).slice(0, 4);

  // 3. Mejores productos (Momence sales.csv)
  const sales = loadSales();
  const topProducts = salesByProduct(sales).slice(0, 4);
  const totalRev = topProducts.reduce((s, p) => s + p.revenue, 0);

  // ── Ocupación detallada ──
  const byTeacher  = occupancyByTeacher(past);
  const byWeekday  = occupancyByWeekday(past);
  const heatmap    = occupancyHeatmap(past);
  const uscByHour    = urbanBookingsByHour();
  const uscByWeekday = urbanBookingsByWeekday();
  const uscTotal     = uscByHour.reduce((s, r) => s + r.count, 0);

  const maxTeacherOcc = Math.max(...byTeacher.map((r) => r.avgOcc), 0.01);
  const maxWeekdayOcc = Math.max(...byWeekday.map((r) => r.avgOcc), 0.01);
  const maxHourOcc    = Math.max(...byHour.map((r) => r.avgOcc), 0.01);
  const maxUscHour    = Math.max(...uscByHour.map((r) => r.count), 1);
  const maxUscWeekday = Math.max(...uscByWeekday.map((r) => r.count), 1);

  const heatmapDays  = [0, 1, 2, 3, 4];
  const heatmapHours = [...new Set(heatmap.map((c) => c.hour))].sort((a, b) => a - b);
  const heatCell = (wd: number, hour: number) =>
    heatmap.find((c) => c.weekday === wd && c.hour === hour);
  const WEEKDAY_SHORT = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

  // ── Format helpers ──
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  // ── Formato de fecha de sincronización ──
  const TZ = "Europe/Madrid";
  function fmtSync(iso: string | Date): string {
    const d = typeof iso === "string" ? new Date(iso) : iso;
    const nowStr = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    const dStr   = d.toLocaleDateString("en-CA", { timeZone: TZ });
    const timeStr = d.toLocaleTimeString("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
    const DAYS   = ["dom","lun","mar","mié","jue","vie","sáb"];
    const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const localD = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
    if (dStr === nowStr) return `hoy · ${timeStr}`;
    const yesterday = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toLocaleDateString("en-CA", { timeZone: TZ });
    if (dStr === yStr) return `ayer · ${timeStr}`;
    return `${DAYS[localD.getDay()]} ${localD.getDate()} ${MONTHS[localD.getMonth()]} · ${timeStr}`;
  }

  const momenceSync = fmtSync(new Date());
  const bankSync    = latestBankImport ? fmtSync(latestBankImport) : null;

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">

      {/* ── Sync status ── */}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <span className="text-[11px] text-navy/45 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
          <span className="font-medium text-navy/45">Momence</span>
          {" · "}actualizado {momenceSync}
        </span>
        {bankSync && (
          <span className="text-[11px] text-navy/45 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-navy/20 inline-block" />
            <span className="font-medium text-navy/45">Banco</span>
            {" · "}última importación {bankSync}
          </span>
        )}
      </div>

      {/* ── Hoy ── */}
      {todayEvents.length > 0 && (() => {
        const todayLabel = new Date().toLocaleDateString("es-ES", {
          timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long",
        });
        return (
          <section>
            <SectionHeader
              title={todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
              subtitle={`${todayEvents.length} ${todayEvents.length === 1 ? "clase programada" : "clases programadas"}`}
              accent="primary"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {todayEvents.map((e) => {
                const fillRate = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
                const fillColor = fillRate >= 0.7 ? "text-success" : fillRate >= 0.4 ? "text-warning" : "text-danger";
                const time = new Date(e.dateTime).toLocaleTimeString("es-ES", {
                  timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit",
                });
                return (
                  <Card key={e.id} className="flex items-center gap-4 py-3.5">
                    <span className="text-base font-semibold text-navy/35 tabular-nums w-12 shrink-0 text-center">{time}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{e.title}</p>
                      <p className="text-xs text-navy/50 mt-0.5">{e.teacher}</p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums shrink-0 ${fillColor}`}>
                      {e.ticketsSold}/{e.capacity}
                    </span>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* ── 1. RENDIMIENTO ── */}
      <section className="space-y-4">
        <SectionHeader title="Rendimiento" subtitle="Últimos 30 días vs. período anterior" accent="primary" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {kpis.map((k) => {
            const valueColor =
              k.colorMode === "occupancy"
                ? k.occupancy! >= 0.7 ? "text-success" : k.occupancy! >= 0.4 ? "text-warning" : "text-danger"
                : "text-navy";
            return (
              <Card key={k.label}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs text-navy/55 uppercase tracking-wider leading-tight">{k.label}</p>
                  {k.trend !== null && <TrendBadge value={k.trend} />}
                </div>
                <p className={`text-2xl font-semibold ${valueColor}`}>{k.value}</p>
                <p className="text-xs text-navy/55 mt-1">{k.sub}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ── 2. ALERTAS ── */}
      <section>
        <SectionHeader title="Alertas" subtitle="Puntos que requieren atención" accent="warning" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Clases con baja asistencia */}
          <Card>
            <CardTitle>Clases con baja asistencia</CardTitle>
            {lowOccUpcoming.length === 0 ? (
              <EmptyState label="Todas las clases tienen buena cobertura" />
            ) : (
              <div className="space-y-3">
                {lowOccUpcoming.map((e) => {
                  const fillRate = e.capacity > 0 ? e.ticketsSold / e.capacity : 0;
                  return (
                    <div key={e.id}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-navy truncate max-w-[160px]">{e.title}</p>
                        <span className="text-xs text-danger font-semibold tabular-nums">
                          {e.ticketsSold}/{e.capacity}
                        </span>
                      </div>
                      <OccBar value={fillRate} />
                      <p className="text-[11px] text-navy/50 mt-0.5">{fmtDate(e.dateTime)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Próxima obligación fiscal */}
          <Card>
            <CardTitle>Obligaciones fiscales</CardTitle>
            {nextObligation ? (() => {
              const days = daysUntil(nextObligation.deadline);
              const urgency = days <= 30 ? "text-danger bg-danger/10" : days <= 60 ? "text-warning bg-warning/10" : "text-navy/50 bg-navy/5";
              return (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-navy">{nextObligation.label}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${urgency}`}>
                      {nextObligation.date}
                    </span>
                  </div>
                  <p className="text-xs text-navy/55">
                    {days <= 0 ? "Vence hoy" : `Faltan ${days} días`}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {obligations
                      .filter((o) => daysUntil(o.deadline) >= 0)
                      .slice(0, 4)
                      .map((o) => {
                        const d = daysUntil(o.deadline);
                        const col = d <= 30 ? "text-danger" : d <= 60 ? "text-warning" : "text-navy/45";
                        return (
                          <div key={o.label} className="flex items-center justify-between text-xs">
                            <span className="text-navy/50">{o.label}</span>
                            <span className={`font-medium ${col}`}>{o.date}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })() : (
              <EmptyState label="Sin obligaciones pendientes" />
            )}
          </Card>
        </div>
      </section>

      {/* ── 3. PLANIFICACIÓN ── */}
      {pendingVac.length > 0 && (
        <section>
          <SectionHeader title="Planificación" subtitle="Vacaciones por asignar este año" accent="primary" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingVac.map((p) => (
              <Card key={p.nombre} className="flex items-center justify-between">
                <p className="text-sm font-medium text-navy">{p.nombre}</p>
                <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  {p.pendientes} día{p.pendientes !== 1 ? "s" : ""} pendiente{p.pendientes !== 1 ? "s" : ""}
                </span>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── 5. OPORTUNIDADES ── */}
      <section>
        <SectionHeader title="Oportunidades" subtitle="Lo que mejor está funcionando" accent="success" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

          {/* Clases más demandadas */}
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
                      <span className="text-xs text-success font-semibold tabular-nums">
                        {pct(c.avgOcc)}
                      </span>
                    </div>
                    <OccBar value={c.avgOcc} />
                    <p className="text-[11px] text-navy/50 mt-0.5">{c.count} sesiones</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Mejores franjas horarias */}
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
                    }`}>
                      {pct(h.avgOcc)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Productos más vendidos */}
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

      {/* ── 6. OCUPACIÓN ── */}
      <section>
        <SectionHeader title="Análisis de ocupación" subtitle="Últimos 30 días" accent="primary" />
        <div className="space-y-4">

          {/* Mapa de calor — primero */}
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
                    {heatmapDays.map((wd) => (
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

          {/* Row: Profesora + Día de la semana */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardTitle>Ocupación por profesora</CardTitle>
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
              <CardTitle>Ocupación por día de la semana</CardTitle>
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

          {/* Row: Franja horaria + Urban Sports Club */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardTitle>Ocupación por franja horaria</CardTitle>
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

            <Card>
              <CardTitle>Urban Sports Club · {uscTotal} reservas</CardTitle>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] text-navy/55 uppercase tracking-wider mb-2">Por franja horaria</p>
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
          </div>

        </div>
      </section>

    </main>
  );
}
