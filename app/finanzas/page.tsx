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
import {
  loadTransactions,
  totalOperationalExpenses,
  totalStartupCosts,
  operationalExpensesByCategory,
  expensesByMonth,
} from "@/lib/transactions";
import GastosBreakdown from "./GastosBreakdown";

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
  "#4F6FFF", "#10B981", "#F59E0B", "#8B5CF6",
  "#EF4444", "#06B6D4", "#EC4899", "#84CC16",
];

const EXPENSE_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#84CC16", "#06B6D4", "#8B5CF6", "#EC4899", "#6B7280",
];


const MONTH_NAMES: Record<string, string> = {
  "01":"Ene","02":"Feb","03":"Mar","04":"Abr",
  "05":"May","06":"Jun","07":"Jul","08":"Ago",
  "09":"Sep","10":"Oct","11":"Nov","12":"Dic",
};
function monthLabel(m: string) {
  const [, mm] = m.split("-");
  return MONTH_NAMES[mm] ?? mm;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function Finanzas() {
  // ── Sales ──
  const sales = loadSales();
  const hasSales = sales.length > 0;
  const totalRevenue = totalSalesRevenue(sales);

  const curMonth = "2026-06";
  const prevMonth = "2026-05";
  const cur = revenueForMonth(sales, curMonth);
  const prev = revenueForMonth(sales, prevMonth);
  const curCount = sales.filter((s) => s.paymentDate.startsWith(curMonth)).length;
  const prevCount = sales.filter((s) => s.paymentDate.startsWith(prevMonth)).length;

  const subMonths = ["2026-04", "2026-05", "2026-06"];
  const mrr =
    subMonths.reduce((sum, m) =>
      sum + sales.filter((s) => s.paymentDate.startsWith(m) && s.category === "Suscripción")
               .reduce((s2, s) => s2 + s.amount, 0), 0) / subMonths.length;

  const ticketMedio = sales.length > 0 ? totalRevenue / sales.length : 0;
  const ticketPrev = prevCount > 0 ? prev / prevCount : 0;
  const ticketCur = curCount > 0 ? cur / curCount : 0;

  const recurrente = sales.filter((s) => s.category === "Suscripción")
    .reduce((s, t) => s + t.amount, 0);
  const recurrentePct = totalRevenue > 0 ? recurrente / totalRevenue : 0;

  const byMethod = salesByMethod(sales);
  const urbanRevenue = byMethod.find((m) => m.method === "urban-sports-club")?.revenue ?? 0;
  const urbanPct = totalRevenue > 0 ? urbanRevenue / totalRevenue : 0;
  const puntual = totalRevenue - recurrente - urbanRevenue;

  const byMonth = salesByMonth(sales);
  const byProduct = salesByProduct(sales).sort((a, b) => b.revenue - a.revenue);

  // ── Transactions ──
  const txns = loadTransactions();
  const totalOpEx = totalOperationalExpenses(txns);
  const totalStartup = totalStartupCosts(txns);
  const expByMonth = expensesByMonth(txns);
  const expByCategory = operationalExpensesByCategory(txns);
  const totalExpCat = expByCategory.reduce((s, r) => s + r.total, 0);

  // ── SVG chart math ──
  const allMonths = Array.from(
    new Set([...byMonth.map((m) => m.month), ...expByMonth.keys()])
  ).sort();

  const maxValue = Math.max(
    ...byMonth.map((m) => m.revenue),
    ...Array.from(expByMonth.values()),
    1,
  );
  const mag = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const niceTop = Math.ceil(maxValue / mag) * mag;
  const fmtTick = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`;

  // Transactions grouped by category for the drawer
  const transactionsByCategory: Record<string, { date: string; amount: number; concept: string; contact: string }[]> = {};
  for (const t of txns) {
    if (!transactionsByCategory[t.category]) transactionsByCategory[t.category] = [];
    transactionsByCategory[t.category].push({ date: t.date, amount: t.amount, concept: t.concept, contact: t.contact });
  }

  // SVG viewport — 900 to match container width so font sizes render correctly
  const SVG_W = 900;
  const SVG_H = 220;
  const MT = 30; // margin top
  const MR = 12;
  const MB = 28; // margin bottom
  const ML = 42; // margin left
  const cW = SVG_W - ML - MR;   // chart width
  const cH = SVG_H - MT - MB;   // chart height

  const N = allMonths.length;
  const groupW = cW / Math.max(N, 1);
  const barW = Math.min(Math.max(groupW * 0.33, 6), 36);
  const barGap = 4;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceTop * t));

  // ── Donut: products ──
  const R = 40; const CX = 50; const CY = 50;
  const CIRC = 2 * Math.PI * R;

  let offP = 0;
  const productSegments = byProduct.map((p, i) => {
    const share = totalRevenue > 0 ? p.revenue / totalRevenue : 0;
    const dash = share * CIRC;
    const offset = -offP;
    offP += dash;
    return { ...p, share, dash, offset, color: PRODUCT_COLORS[i % PRODUCT_COLORS.length] };
  });

  // ── Momence ──
  const [liveEvents, historicalEvents] = await Promise.all([getEvents(), loadHistoricalEvents()]);
  const allById = new Map(historicalEvents.map((e) => [e.id, e]));
  liveEvents.forEach((e) => allById.set(e.id, e));
  const events = Array.from(allById.values());
  const past30 = filterPast(events, 30);
  const upcoming7 = filterUpcoming(events, 7);
  const past30Students = past30.reduce((s, e) => s + e.ticketsSold, 0);

  // ── Tax obligations ──
  const today = new Date();
  const daysUntil = (d: string) =>
    Math.ceil((new Date(d).getTime() - today.getTime()) / 86_400_000);
  const obligations = [
    { label: "IVA T2",       date: "20 jul", deadline: "2026-07-20" },
    { label: "IRPF T2",      date: "20 jul", deadline: "2026-07-20" },
    { label: "IVA T3",       date: "20 oct", deadline: "2026-10-20" },
    { label: "IRPF T3",      date: "20 oct", deadline: "2026-10-20" },
    { label: "IVA T4 / Anual",date: "20 ene",deadline: "2027-01-20" },
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
          <KpiCard label="Junio 2026" value={fmt(cur)} sub={`${curCount} transacciones`} trend={trendPct(cur, prev)} />
          <KpiCard label="Mayo 2026" value={fmt(prev)} sub={`${prevCount} transacciones`} />
          <KpiCard label="MRR estimado" value={fmt(mrr)} sub="Media suscripciones · últ. 3 meses" />
          <KpiCard label="Ticket medio" value={fmt(ticketMedio)} sub={`${sales.length} transacciones totales`} trend={trendPct(ticketCur, ticketPrev)} />
        </div>
      </section>

      {/* ── Gráfico mensual — SVG estilo Kabilio ── */}
      <div className="bg-white border border-navy/10 rounded shadow-card p-5">
        <div className="flex items-start justify-between mb-5">
          <p className="text-xs font-semibold text-navy/40 uppercase tracking-widest">
            Ingresos y gastos mensuales · 2026
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-navy/50">
              <span className="w-3 h-2.5 rounded-sm inline-block" style={{ backgroundColor: "#818CF8" }} />
              Ingresos
            </span>
            <span className="flex items-center gap-1.5 text-xs text-navy/50">
              <span className="w-3 h-2.5 rounded-sm inline-block" style={{ backgroundColor: "#FCA5A5" }} />
              Gastos
            </span>
          </div>
        </div>

        <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} overflow="visible">
          {/* Horizontal grid lines + Y-axis labels */}
          {yTicks.map((t) => {
            const y = MT + cH * (1 - t / niceTop);
            return (
              <g key={t}>
                <line x1={ML} y1={y} x2={SVG_W - MR} y2={y} stroke="#E2E8F0" strokeWidth="1" />
                <text x={ML - 5} y={y + 3.5} textAnchor="end" fontSize="10" fill="#94A3B8">
                  {fmtTick(t)}
                </text>
              </g>
            );
          })}

          {/* Bars per month */}
          {allMonths.map((month, i) => {
            const income  = byMonth.find((m) => m.month === month)?.revenue ?? 0;
            const expense = expByMonth.get(month) ?? 0;
            const isCurrent = month === curMonth;
            const opacity = isCurrent ? 0.5 : 1;

            const cx = ML + (i + 0.5) * groupW;
            const ix = cx - barGap / 2 - barW;
            const ex = cx + barGap / 2;

            const ih = income  > 0 ? (income  / niceTop) * cH : 0;
            const eh = expense > 0 ? (expense / niceTop) * cH : 0;
            const iy = MT + cH - ih;
            const ey = MT + cH - eh;

            return (
              <g key={month}>
                {/* Income bar + label */}
                {income > 0 && (
                  <>
                    <rect x={ix} y={iy} width={barW} height={ih} rx="3" fill="#818CF8" opacity={opacity} />
                    <text x={ix + barW / 2} y={iy - 4} textAnchor="middle" fontSize="8.5" fill="#6366F1" fontWeight="600" opacity={opacity}>
                      {fmtTick(Math.round(income))}
                    </text>
                  </>
                )}
                {/* Expense bar + label */}
                {expense > 0 && (
                  <>
                    <rect x={ex} y={ey} width={barW} height={eh} rx="3" fill="#FCA5A5" opacity={opacity} />
                    <text x={ex + barW / 2} y={ey - 4} textAnchor="middle" fontSize="8.5" fill="#F87171" fontWeight="600" opacity={opacity}>
                      {fmtTick(Math.round(expense))}
                    </text>
                  </>
                )}
                {/* Month label */}
                <text x={cx} y={SVG_H - MB + 14} textAnchor="middle" fontSize="9.5" fill="#94A3B8">
                  {monthLabel(month)}{isCurrent ? "*" : ""}
                </text>
              </g>
            );
          })}
        </svg>

        {allMonths.includes(curMonth) && (
          <p className="text-[10px] text-navy/30 mt-2">
            * {monthLabel(curMonth)} parcial — datos hasta hoy
          </p>
        )}
        <p className="text-[10px] text-navy/30 mt-1">
          Ingresos: Momence sales.csv · Gastos: exportación bancaria Caixabank.
        </p>
      </div>

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
              <div className="h-full bg-income rounded-full"
                style={{ width: pct(totalRevenue > 0 ? puntual / totalRevenue : 0) }} />
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
          Fuente: sales.csv · categoría (Suscripción / Paquete / Clase) y método de pago.
        </p>
      </section>

      {/* Por producto y canal */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Block title="Por producto" legend="Fuente: sales.csv · ticket medio = ingresos / ventas por producto.">
          {productSegments.length > 0 ? (
            <div className="flex gap-5 items-start">
              <div className="shrink-0">
                <svg width="120" height="120" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                  {productSegments.map((seg, i) => (
                    <circle key={i} cx={CX} cy={CY} r={R} fill="none"
                      stroke={seg.color} strokeWidth={20}
                      strokeDasharray={`${seg.dash} ${CIRC - seg.dash}`}
                      strokeDashoffset={seg.offset} />
                  ))}
                </svg>
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                {productSegments.map((seg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
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

        <Block title="Por canal de pago" legend="Fuente: sales.csv · método de pago registrado en cada transacción.">
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
                      <span className="text-xs font-medium text-navy tabular-nums w-16 text-right">{fmt(row.revenue)}</span>
                      <span className="text-xs text-navy/40 w-8 text-right tabular-nums">{pct(share)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-navy/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: pct(share) }} />
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

      {/* ── Gastos ── */}
      <section>
        <h2 className="text-xs font-semibold text-navy/40 uppercase tracking-widest mb-4">
          Gastos · banco Caixabank
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
          <KpiCard label="Gastos operativos" value={fmt(totalOpEx)} sub="dic 2025 – abr 2026" />
          <KpiCard label="Inversión inicial" value={fmt(totalStartup)} sub="Reforma, maquinaria, mobiliario" />
          <KpiCard label="Total gastos" value={fmt(totalOpEx + totalStartup)}
            sub={`${txns.filter((t) => t.amount < 0 && t.category !== "skip" && t.category !== "capital" && t.category !== "financing").length} transacciones`} />
          <KpiCard label="Resultado operativo" value={fmt(totalRevenue - totalOpEx)}
            sub="Ingresos Momence – gastos op."
            trend={totalRevenue - totalOpEx > 0 ? 1 : -1} />
        </div>

        {/* Expense breakdown — Kabilio emoji style */}
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <div className="flex items-start justify-between mb-5">
            <p className="text-xs font-semibold text-navy/40 uppercase tracking-wider">
              Desglose gastos operativos
            </p>
            <p className="text-xs text-navy/30">dic 2025 – abr 2026</p>
          </div>

          <GastosBreakdown
            categories={expByCategory.map((e, i) => ({
              ...e,
              color: EXPENSE_COLORS[i % EXPENSE_COLORS.length],
            }))}
            transactionsByCategory={transactionsByCategory}
            totalExpCat={totalExpCat}
          />

          <p className="text-[10px] text-navy/30 mt-4 pt-3 border-t border-navy/5 leading-relaxed">
            Fuente: exportación bancaria Caixabank · excluye aportaciones de socios, préstamo e inversión inicial.
          </p>
        </div>
      </section>

      {/* Obligaciones fiscales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-xs font-semibold text-navy/40 uppercase tracking-wider mb-4">
            IVA estimado · próximo trimestre
          </p>
          <p className="text-3xl font-semibold text-navy/20">—</p>
          <p className="text-xs text-navy/30 mt-2 leading-relaxed">
            Disponible cuando añadas facturas con IVA desglosado (repercutido – soportado).
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
              const badgeClass = days <= 30
                ? "bg-danger/10 text-danger"
                : days <= 60
                ? "bg-warning/10 text-warning"
                : "bg-navy/5 text-navy/40";
              return (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-sm text-navy">{label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeClass}`}>{date}</span>
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
          <KpiCard label="Ocupación media" value={pct(occupancyRate(past30))} sub={`${past30.length} clases impartidas`} />
          <KpiCard label="Alumnos (30 días)" value={past30Students.toString()}
            sub={`Media ${past30.length > 0 ? (past30Students / past30.length).toFixed(1) : 0} por clase`} />
          <KpiCard label="Próximos 7 días"
            value={`${upcoming7.reduce((s, e) => s + e.ticketsSold, 0)} reservas`}
            sub={`${upcoming7.length} clases programadas`} />
        </div>
        <p className="text-[10px] text-navy/30 mt-3">
          Fuente: Momence API · eventos activos de los últimos 30 días y próximos 7 días.
        </p>
      </section>

    </main>
  );
}
