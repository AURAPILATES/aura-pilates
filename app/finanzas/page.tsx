import { getEvents } from "@/lib/momence";
import { loadHistoricalEvents } from "@/lib/history";
import { filterPast, filterUpcoming, fmt, occupancyRate, pct } from "@/lib/analytics";
import {
  loadSales,
  salesByMonth,
  salesByMethod,
  salesByProduct,
  totalSalesRevenue,
  revenueForMonth,
} from "@/lib/sales";

// ── Helpers ───────────────────────────────────────────────────────────────────

function trendPct(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={`text-xs font-medium shrink-0 ${up ? "text-success" : "text-danger"}`}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(value))}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
}) {
  return (
    <div className="bg-white border border-navy/10 rounded shadow-card p-5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs text-navy/40 uppercase tracking-wider leading-tight">{label}</p>
        {trend !== undefined && <TrendBadge value={trend ?? null} />}
      </div>
      <p className="text-2xl font-semibold text-navy">{value}</p>
      {sub && <p className="text-xs text-navy/40 mt-1">{sub}</p>}
    </div>
  );
}

function Block({
  title,
  legend,
  children,
}: {
  title: string;
  legend?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-navy/10 rounded shadow-card p-5">
      <p className="text-xs font-semibold text-navy/40 uppercase tracking-wider mb-4">{title}</p>
      {children}
      {legend && (
        <p className="text-[10px] text-navy/30 mt-4 pt-3 border-t border-navy/5 leading-relaxed">
          {legend}
        </p>
      )}
    </div>
  );
}

const PRODUCT_COLORS = [
  "#4F6FFF", // primary blue
  "#10B981", // income green
  "#F59E0B", // warning amber
  "#8B5CF6", // purple
  "#EF4444", // danger red
  "#06B6D4", // cyan
  "#EC4899", // pink
  "#84CC16", // lime
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function Finanzas() {
  const sales = loadSales();
  const hasSales = sales.length > 0;
  const totalRevenue = totalSalesRevenue(sales);

  const curMonth = "2026-06";
  const prevMonth = "2026-05";
  const cur = revenueForMonth(sales, curMonth);
  const prev = revenueForMonth(sales, prevMonth);
  const curCount = sales.filter((s) => s.paymentDate.startsWith(curMonth)).length;
  const prevCount = sales.filter((s) => s.paymentDate.startsWith(prevMonth)).length;

  // MRR estimado: media de ingresos por suscripción en los últimos 3 meses
  const subMonths = ["2026-04", "2026-05", "2026-06"];
  const mrr =
    subMonths.reduce((sum, m) => {
      return (
        sum +
        sales
          .filter((s) => s.paymentDate.startsWith(m) && s.category === "Suscripción")
          .reduce((s2, s) => s2 + s.amount, 0)
      );
    }, 0) / subMonths.length;

  // Ticket medio
  const ticketMedio = sales.length > 0 ? totalRevenue / sales.length : 0;
  const ticketPrev = prevCount > 0 ? prev / prevCount : 0;
  const ticketCur = curCount > 0 ? cur / curCount : 0;

  // Recurrente vs puntual
  const recurrente = sales
    .filter((s) => s.category === "Suscripción")
    .reduce((s, t) => s + t.amount, 0);
  const recurrentePct = totalRevenue > 0 ? recurrente / totalRevenue : 0;

  // Urban
  const byMethod = salesByMethod(sales);
  const urbanRevenue = byMethod.find((m) => m.method === "urban-sports-club")?.revenue ?? 0;
  const urbanPct = totalRevenue > 0 ? urbanRevenue / totalRevenue : 0;
  const puntual = totalRevenue - recurrente - urbanRevenue;

  // Por mes
  const byMonth = salesByMonth(sales);
  const maxMonthRevenue = Math.max(...byMonth.map((m) => m.revenue), 1);

  // Por producto — ordenado por revenue desc
  const byProduct = salesByProduct(sales).sort((a, b) => b.revenue - a.revenue);

  // Momence events
  const [liveEvents, historicalEvents] = await Promise.all([getEvents(), loadHistoricalEvents()]);
  const allById = new Map(historicalEvents.map((e) => [e.id, e]));
  liveEvents.forEach((e) => allById.set(e.id, e));
  const events = Array.from(allById.values());
  const past30 = filterPast(events, 30);
  const upcoming7 = filterUpcoming(events, 7);
  const past30Students = past30.reduce((s, e) => s + e.ticketsSold, 0);

  // Donut chart math
  const R = 40;
  const CX = 50;
  const CY = 50;
  const CIRC = 2 * Math.PI * R;
  let offsetAcc = 0;
  const donutSegments = byProduct.map((p, i) => {
    const share = totalRevenue > 0 ? p.revenue / totalRevenue : 0;
    const dash = share * CIRC;
    const offset = -offsetAcc;
    offsetAcc += dash;
    return { ...p, share, dash, offset, color: PRODUCT_COLORS[i % PRODUCT_COLORS.length] };
  });

  // Bar chart Y-axis
  const mag = Math.pow(10, Math.floor(Math.log10(maxMonthRevenue)));
  const niceTop = Math.ceil(maxMonthRevenue / mag) * mag;
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((t) => Math.round(niceTop * t));
  const fmtTick = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`);

  // Tax obligations
  const today = new Date();
  const daysUntil = (dateStr: string) =>
    Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86_400_000);
  const obligations = [
    { label: "IVA T2", date: "20 jul", deadline: "2026-07-20" },
    { label: "IRPF T2", date: "20 jul", deadline: "2026-07-20" },
    { label: "IVA T3", date: "20 oct", deadline: "2026-10-20" },
    { label: "IRPF T3", date: "20 oct", deadline: "2026-10-20" },
    { label: "IVA T4 / Anual", date: "20 ene", deadline: "2027-01-20" },
  ];

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

      {!hasSales && (
        <div className="bg-warning/10 border border-warning/30 rounded p-4 text-sm text-warning">
          Sin datos de ventas. Copia el CSV de Momence a{" "}
          <code className="font-mono bg-warning/10 px-1 rounded text-xs">data/sales.csv</code>.
        </div>
      )}

      {/* KPIs */}
      <section>
        <h2 className="text-xs font-semibold text-navy/40 uppercase tracking-widest mb-4">
          Resumen financiero
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard
            label="Junio 2026"
            value={fmt(cur)}
            sub={`${curCount} transacciones`}
            trend={trendPct(cur, prev)}
          />
          <KpiCard label="Mayo 2026" value={fmt(prev)} sub={`${prevCount} transacciones`} />
          <KpiCard label="MRR estimado" value={fmt(mrr)} sub="Media suscripciones · últ. 3 meses" />
          <KpiCard
            label="Ticket medio"
            value={fmt(ticketMedio)}
            sub={`${sales.length} transacciones totales`}
            trend={trendPct(ticketCur, ticketPrev)}
          />
        </div>
      </section>

      {/* Gráfico mensual con eje Y y etiquetas */}
      {byMonth.length > 0 && (
        <Block title="Ingresos por mes" legend="Fuente: sales.csv · fecha de pago.">
          <div className="flex gap-3">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-between flex-shrink-0 pb-8" style={{ height: 180 }}>
              {yTicks.map((t) => (
                <span key={t} className="text-[10px] text-navy/30 leading-none text-right w-8">
                  {fmtTick(t)}
                </span>
              ))}
            </div>
            {/* Chart area */}
            <div className="flex-1 flex flex-col">
              <div className="relative" style={{ height: 148 }}>
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                  <div
                    key={t}
                    className="absolute left-0 right-0 border-t border-navy/5 pointer-events-none"
                    style={{ bottom: `${t * 100}%` }}
                  />
                ))}
                {/* Bars */}
                <div className="absolute inset-0 flex items-stretch gap-2">
                  {byMonth.map(({ month, revenue }) => {
                    const hPct = (revenue / niceTop) * 100;
                    const isCurrent = month === curMonth;
                    return (
                      <div key={month} className="flex-1 relative">
                        <span
                          className="absolute left-0 right-0 text-center text-[10px] text-navy/50 tabular-nums leading-none"
                          style={{ bottom: `calc(${Math.max(hPct, 3)}% + 5px)` }}
                        >
                          {fmt(revenue)}
                        </span>
                        <div
                          className={`absolute left-0 right-0 bottom-0 rounded-t transition-colors cursor-default ${
                            isCurrent ? "bg-primary" : "bg-navy/15 hover:bg-navy/25"
                          }`}
                          style={{ height: `${Math.max(hPct, 3)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* X-axis */}
              <div className="flex gap-2 mt-2 pt-2 border-t border-navy/10">
                {byMonth.map(({ month, label }) => {
                  const isCurrent = month === curMonth;
                  return (
                    <div key={month} className="flex-1 text-center">
                      <span
                        className={`text-xs ${isCurrent ? "text-primary font-medium" : "text-navy/40"}`}
                      >
                        {label.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Block>
      )}

      {/* Estructura de ingresos */}
      <section>
        <h2 className="text-xs font-semibold text-navy/40 uppercase tracking-widest mb-4">
          Estructura de ingresos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-navy/10 rounded shadow-card p-5">
            <p className="text-xs text-navy/40 uppercase tracking-wider mb-3">Suscripciones</p>
            <p className="text-3xl font-semibold text-primary">{fmt(recurrente)}</p>
            <p className="text-xs text-navy/40 mt-1">{pct(recurrentePct)} del total</p>
            <div className="mt-4 h-1.5 bg-navy/5 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: pct(recurrentePct) }} />
            </div>
          </div>
          <div className="bg-white border border-navy/10 rounded shadow-card p-5">
            <p className="text-xs text-navy/40 uppercase tracking-wider mb-3">Packs y clases sueltas</p>
            <p className="text-3xl font-semibold text-income">{fmt(puntual)}</p>
            <p className="text-xs text-navy/40 mt-1">
              {pct(totalRevenue > 0 ? puntual / totalRevenue : 0)} del total
            </p>
            <div className="mt-4 h-1.5 bg-navy/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-income rounded-full"
                style={{ width: pct(totalRevenue > 0 ? puntual / totalRevenue : 0) }}
              />
            </div>
          </div>
          <div className="bg-white border border-navy/10 rounded shadow-card p-5">
            <p className="text-xs text-navy/40 uppercase tracking-wider mb-3">Urban Sports Club</p>
            <p className="text-3xl font-semibold text-warning">{fmt(urbanRevenue)}</p>
            <p className="text-xs text-navy/40 mt-1">{pct(urbanPct)} del total</p>
            <div className="mt-4 h-1.5 bg-navy/5 rounded-full overflow-hidden">
              <div className="h-full bg-warning rounded-full" style={{ width: pct(urbanPct) }} />
            </div>
          </div>
        </div>
        <p className="text-[10px] text-navy/30 mt-3">
          Fuente: sales.csv · clasificación por categoría de producto (Suscripción / Paquete / Clase) y método de pago.
        </p>
      </section>

      {/* Por producto (donut) y canal */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Block
          title="Por producto"
          legend="Fuente: sales.csv · ticket medio = ingresos / número de ventas por producto."
        >
          {donutSegments.length > 0 ? (
            <div className="flex gap-5 items-start">
              {/* Donut SVG */}
              <div className="shrink-0">
                <svg
                  width="120"
                  height="120"
                  viewBox="0 0 100 100"
                  style={{ transform: "rotate(-90deg)" }}
                >
                  {donutSegments.map((seg, i) => (
                    <circle
                      key={i}
                      cx={CX}
                      cy={CY}
                      r={R}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={20}
                      strokeDasharray={`${seg.dash} ${CIRC - seg.dash}`}
                      strokeDashoffset={seg.offset}
                    />
                  ))}
                </svg>
              </div>
              {/* List */}
              <div className="flex-1 space-y-3 min-w-0">
                {donutSegments.map((seg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="shrink-0 w-2 h-2 rounded-full"
                      style={{ backgroundColor: seg.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-navy truncate">{seg.item}</p>
                      <p className="text-[10px] text-navy/40">{seg.count} ventas</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-navy tabular-nums">{fmt(seg.revenue)}</p>
                      <p className="text-[10px] text-navy/40 tabular-nums">{pct(seg.share)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-navy/30">Sin datos de productos.</p>
          )}
        </Block>

        <Block
          title="Por canal de pago"
          legend="Fuente: sales.csv · método de pago registrado en cada transacción."
        >
          <div className="space-y-4">
            {byMethod.map((row) => {
              const share = totalRevenue > 0 ? row.revenue / totalRevenue : 0;
              const barColor = row.method === "urban-sports-club" ? "bg-warning" : "bg-primary";
              return (
                <div key={row.method}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-navy">{row.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-navy/40 tabular-nums">{row.count} ventas</span>
                      <span className="text-xs font-medium text-navy tabular-nums w-16 text-right">
                        {fmt(row.revenue)}
                      </span>
                      <span className="text-xs text-navy/40 w-8 text-right tabular-nums">
                        {pct(share)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-navy/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: pct(share) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-navy/5 flex justify-between">
            <span className="text-xs text-navy/40">Total histórico</span>
            <span className="text-xs font-semibold text-navy">{fmt(totalRevenue)}</span>
          </div>
        </Block>
      </div>

      {/* Obligaciones fiscales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-xs font-semibold text-navy/40 uppercase tracking-wider mb-4">
            IVA estimado · próximo trimestre
          </p>
          <p className="text-3xl font-semibold text-navy/20">—</p>
          <p className="text-xs text-navy/30 mt-2 leading-relaxed">
            Disponible cuando añadas datos de gastos e ingresos con IVA desglosado.
          </p>
          <p className="text-xs font-medium text-warning mt-4">Plazo: 20 julio</p>
        </div>
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-xs font-semibold text-navy/40 uppercase tracking-wider mb-4">
            Próximas obligaciones
          </p>
          <div className="space-y-3">
            {obligations.map(({ label, date, deadline }) => {
              const days = daysUntil(deadline);
              const badgeClass =
                days <= 30
                  ? "bg-danger/10 text-danger"
                  : days <= 60
                  ? "bg-warning/10 text-warning"
                  : "bg-navy/5 text-navy/40";
              return (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-navy">{label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeClass}`}>
                    {date}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ocupación */}
      <section>
        <h2 className="text-xs font-semibold text-navy/40 uppercase tracking-widest mb-4">
          Ocupación · últimos 30 días
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Ocupación media"
            value={pct(occupancyRate(past30))}
            sub={`${past30.length} clases impartidas`}
          />
          <KpiCard
            label="Alumnos (30 días)"
            value={past30Students.toString()}
            sub={`Media ${past30.length > 0 ? (past30Students / past30.length).toFixed(1) : 0} por clase`}
          />
          <KpiCard
            label="Próximos 7 días"
            value={`${upcoming7.reduce((s, e) => s + e.ticketsSold, 0)} reservas`}
            sub={`${upcoming7.length} clases programadas`}
          />
        </div>
        <p className="text-[10px] text-navy/30 mt-3">
          Fuente: Momence API · eventos activos de los últimos 30 días y próximos 7 días.
        </p>
      </section>

    </main>
  );
}
