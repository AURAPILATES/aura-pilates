import { Suspense } from "react";
import { BookOpen } from "react-feather";
import { getEvents } from "@/lib/momence";
import { loadHistoricalEvents } from "@/lib/history";
import { filterPast, filterUpcoming, fmt, occupancyRate, pct } from "@/lib/analytics";
import {
  loadSales,
  filterSalesByDate,
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
} from "@/lib/transactions";
import { getDateRange } from "@/lib/dateRange";
import DateFilter from "@/app/components/DateFilter";
import GastosBreakdown from "./GastosBreakdown";
import FinanzasBarChart from "./FinanzasBarChart";
import EvolucionChart from "./EvolucionChart";

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
        <p className="text-xs text-navy/30 mt-4 pt-3 border-t border-navy/5 leading-relaxed flex items-start gap-1.5">
          <BookOpen size={12} className="shrink-0 mt-0.5" />
          {legend}
        </p>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  description,
  accent,
}: {
  title: string;
  description: string;
  accent: "primary" | "income" | "warning";
}) {
  const bar: Record<string, string> = {
    primary: "bg-primary",
    income:  "bg-income",
    warning: "bg-warning",
  };
  const text: Record<string, string> = {
    primary: "text-primary",
    income:  "text-income",
    warning: "text-warning",
  };
  return (
    <div className="flex gap-4 items-start">
      <div className={`w-1 self-stretch rounded-full shrink-0 ${bar[accent]}`} />
      <div>
        <h2 className={`text-sm font-bold uppercase tracking-widest ${text[accent]}`}>
          {title}
        </h2>
        <p className="text-xs text-navy/40 mt-0.5">{description}</p>
      </div>
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


// ── Operational burn categories (recurring monthly costs only) ────────────────
const BURN_CATS = new Set([
  "Alquiler","Salarios","Electricidad","Agua","Software","Gestoría y legal",
  "Impuestos y tasas","Teléfono","Seguros","Comisiones bancarias","Merchandising","Local","Otros",
]);

// ── Page ──────────────────────────────────────────────────────────────────────

const MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MES[parseInt(m, 10) - 1]} ${y}`;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

export default async function Finanzas(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const { from, to } = getDateRange(sp.range);

  // ── Sales (all for health metrics; filtered for period analysis) ──
  const salesAll = loadSales();
  const sales    = filterSalesByDate(salesAll, from, to);
  const hasSales = salesAll.length > 0;
  const totalRevenue = totalSalesRevenue(sales);

  // Dynamic current/prev month (always today-relative, independent of filter)
  const now = new Date();
  const curMonth  = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${pad2(prevMonthDate.getMonth() + 1)}`;

  const cur       = revenueForMonth(salesAll, curMonth);
  const prev      = revenueForMonth(salesAll, prevMonth);
  const curCount  = salesAll.filter((s) => s.paymentDate.startsWith(curMonth)).length;
  const prevCount = salesAll.filter((s) => s.paymentDate.startsWith(prevMonth)).length;

  const prev2MonthDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const prev2Month = `${prev2MonthDate.getFullYear()}-${pad2(prev2MonthDate.getMonth() + 1)}`;
  const subMonths = [prev2Month, prevMonth, curMonth];
  const mrr =
    subMonths.reduce((sum, m) =>
      sum + salesAll.filter((s) => s.paymentDate.startsWith(m) && s.category === "Suscripción")
               .reduce((s2, s) => s2 + s.amount, 0), 0) / subMonths.length;

  const ticketMedio = sales.length > 0 ? totalRevenue / sales.length : 0;
  const ticketPrev = prevCount > 0 ? prev / prevCount : 0;
  const ticketCur  = curCount > 0 ? cur / curCount : 0;

  const recurrente    = sales.filter((s) => s.category === "Suscripción").reduce((s, t) => s + t.amount, 0);
  const recurrentePct = totalRevenue > 0 ? recurrente / totalRevenue : 0;

  const byMethod    = salesByMethod(sales);
  const urbanRevenue = byMethod.find((m) => m.method === "urban-sports-club")?.revenue ?? 0;
  const urbanPct    = totalRevenue > 0 ? urbanRevenue / totalRevenue : 0;
  const puntual     = totalRevenue - recurrente - urbanRevenue;

  const byProduct = salesByProduct(sales).sort((a, b) => b.revenue - a.revenue);

  // ── Transactions ──
  const txnsAll = await loadTransactions();
  const txns    = (from || to) ? await loadTransactions(from, to) : txnsAll;
  const totalOpEx    = totalOperationalExpenses(txns);
  const totalStartup = totalStartupCosts(txns);
  const expByCategory = operationalExpensesByCategory(txns);
  const totalExpCat   = expByCategory.reduce((s, r) => s + r.total, 0);

  // ── Salud financiera (siempre sobre datos completos, no filtrados) ──
  const today_ym = curMonth;

  // Saldo actual: transacción más reciente con balance
  const currentBalance = [...txnsAll]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null)?.balance ?? null;
  const balanceDate = [...txnsAll]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null)?.date ?? null;

  // Burn rate: media de costes operativos de los últimos 3 meses completos
  const burnByMonth = new Map<string, number>();
  for (const t of txnsAll) {
    if (t.amount >= 0 || !BURN_CATS.has(t.category)) continue;
    const m = t.date.slice(0, 7);
    burnByMonth.set(m, (burnByMonth.get(m) ?? 0) + Math.abs(t.amount));
  }
  const completeBurnMonths = [...burnByMonth.keys()]
    .filter((m) => m < today_ym)
    .sort()
    .reverse()
    .slice(0, 3);
  const avgMonthlyBurn = completeBurnMonths.length > 0
    ? completeBurnMonths.reduce((s, m) => s + burnByMonth.get(m)!, 0) / completeBurnMonths.length
    : 0;

  // Runway
  const runwayMonths = currentBalance !== null && avgMonthlyBurn > 0
    ? currentBalance / avgMonthlyBurn
    : null;

  // Ingresos medios mensuales (últimos 3 meses completos de ventas Momence — datos completos)
  const revMonths = [...new Set(salesAll.map((s) => s.paymentDate.slice(0, 7)))]
    .filter((m) => m < today_ym)
    .sort()
    .reverse()
    .slice(0, 3);
  const avgMonthlyRevenue = revMonths.length > 0
    ? revMonths.reduce((s, m) => s + revenueForMonth(salesAll, m), 0) / revMonths.length
    : 0;

  // Break-even gap (positivo = pérdida mensual; negativo = rentable)
  const breakEvenGap = avgMonthlyBurn - avgMonthlyRevenue;
  const clientesNecesarios = breakEvenGap > 0 && ticketMedio > 0
    ? Math.ceil(breakEvenGap / ticketMedio)
    : null;

  const transactionsByCategory: Record<string, { date: string; amount: number; concept: string; contact: string }[]> = {};
  for (const t of txns) {
    if (!transactionsByCategory[t.category]) transactionsByCategory[t.category] = [];
    transactionsByCategory[t.category].push({ date: t.date, amount: t.amount, concept: t.concept ?? "", contact: t.contact ?? "" });
  }

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
    { label: "IVA T2",        date: "20 jul", deadline: "2026-07-20" },
    { label: "IRPF T2",       date: "20 jul", deadline: "2026-07-20" },
    { label: "IVA T3",        date: "20 oct", deadline: "2026-10-20" },
    { label: "IRPF T3",       date: "20 oct", deadline: "2026-10-20" },
    { label: "IVA T4 / Anual",date: "20 ene", deadline: "2027-01-20" },
  ];

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-12">

      <Suspense fallback={null}>
        <DateFilter />
      </Suspense>

      {!hasSales && (
        <div className="bg-warning/10 border border-warning/30 rounded p-4 text-sm text-warning">
          Sin datos de ventas. Copia el CSV de Momence a{" "}
          <code className="font-mono bg-warning/10 px-1 rounded text-xs">data/sales.csv</code>.
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          § 0. SALUD FINANCIERA — Runway y break-even
      ════════════════════════════════════════════════════════ */}
      <section className="space-y-4">
        <SectionHeader
          title="Salud financiera"
          description="¿Cuánto aguanta el negocio y cuándo será rentable?"
          accent="primary"
        />
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-0 lg:divide-x lg:divide-navy/5">

            {/* Saldo actual */}
            <div className="lg:pr-6 pb-5 lg:pb-0 border-b lg:border-b-0 border-navy/5 col-span-1">
              <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-3">Saldo en cuenta</p>
              {currentBalance !== null ? (
                <>
                  <p className="text-3xl font-semibold text-navy tabular-nums">{fmt(currentBalance)}</p>
                  <p className="text-xs text-navy/30 mt-1.5">
                    Último mov. {balanceDate ? balanceDate.split("-").reverse().join("/") : "—"}
                  </p>
                </>
              ) : (
                <p className="text-2xl font-semibold text-navy/20">Sin datos</p>
              )}
            </div>

            {/* Burn rate */}
            <div className="lg:px-6 pb-5 lg:pb-0 border-b lg:border-b-0 border-navy/5">
              <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-3">Coste fijo mensual</p>
              <p className="text-3xl font-semibold text-navy tabular-nums">{fmt(avgMonthlyBurn)}</p>
              <p className="text-xs text-navy/30 mt-1.5">
                Media de {completeBurnMonths.length} mes{completeBurnMonths.length !== 1 ? "es" : ""}
              </p>
            </div>

            {/* Runway */}
            <div className="lg:px-6">
              <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-3">Runway</p>
              {runwayMonths !== null ? (
                <>
                  <p className={`text-3xl font-semibold tabular-nums ${
                    runwayMonths < 3 ? "text-danger" : runwayMonths < 6 ? "text-warning" : "text-success"
                  }`}>
                    {runwayMonths.toFixed(1)} meses
                  </p>
                  <div className="flex gap-0.5 mt-3">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const filled = i < Math.round(runwayMonths);
                      const color = runwayMonths < 3
                        ? "bg-danger"
                        : runwayMonths < 6
                        ? "bg-warning"
                        : "bg-success";
                      return (
                        <div
                          key={i}
                          className={`h-2 flex-1 rounded-sm transition-colors ${filled ? color : "bg-navy/5"}`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-navy/25 mt-1">de 12 meses</p>
                </>
              ) : (
                <p className="text-2xl font-semibold text-navy/20">—</p>
              )}
            </div>

            {/* Break-even */}
            <div className="lg:pl-6">
              <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-3">Break-even</p>
              {avgMonthlyRevenue > 0 ? (
                breakEvenGap <= 0 ? (
                  <>
                    <p className="text-3xl font-semibold text-success">Rentable</p>
                    <p className="text-xs text-success/70 mt-1.5">
                      +{fmt(Math.abs(breakEvenGap))}/mes de margen
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-semibold text-danger tabular-nums">−{fmt(breakEvenGap)}</p>
                    <p className="text-xs text-navy/30 mt-1.5">al mes para cubrir costes</p>
                    {clientesNecesarios && (
                      <p className="text-xs text-warning font-medium mt-0.5">
                        ≈ {clientesNecesarios} clientes más al mes
                      </p>
                    )}
                  </>
                )
              ) : (
                <p className="text-2xl font-semibold text-navy/20">Sin ventas</p>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          § 1. FINANZAS — Salud económica del negocio
      ════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <SectionHeader
          title="Finanzas"
          description="Salud económica del negocio · ingresos, gastos y resultado"
          accent="primary"
        />

        {/* KPIs del mes */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label={monthLabel(curMonth)} value={fmt(cur)} sub={`${curCount} transacciones`} trend={trendPct(cur, prev)} />
          <KpiCard label={monthLabel(prevMonth)} value={fmt(prev)} sub={`${prevCount} transacciones`} />
          <KpiCard label="MRR estimado" value={fmt(mrr)} sub="Media suscripciones · últ. 3 meses" />
          <KpiCard label="Ticket medio" value={fmt(ticketMedio)} sub={`${sales.length} transacciones totales`} trend={trendPct(ticketCur, ticketPrev)} />
        </div>

        {/* Ingresos vs gastos */}
        <FinanzasBarChart sales={sales} txns={txns} />

        {/* Gastos */}
        <div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
            <KpiCard label="Gastos operativos" value={fmt(totalOpEx)} sub="dic 2025 – abr 2026" />
            <KpiCard label="Inversión inicial" value={fmt(totalStartup)} sub="Reforma, maquinaria, mobiliario" />
            <KpiCard label="Total gastos" value={fmt(totalOpEx + totalStartup)}
              sub={`${txnsAll.filter((t) => t.amount < 0 && t.category !== "skip" && t.category !== "capital" && t.category !== "financing").length} transacciones`} />
            <KpiCard label="Resultado operativo" value={fmt(totalRevenue - totalOpEx)}
              sub="Ingresos Momence – gastos op."
              trend={totalRevenue - totalOpEx > 0 ? 1 : -1} />
          </div>

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
            <p className="text-xs text-navy/30 mt-4 pt-3 border-t border-navy/5 leading-relaxed flex items-start gap-1.5">
              <BookOpen size={12} className="shrink-0 mt-0.5" />
              exportación bancaria Caixabank · excluye aportaciones de socios, préstamo e inversión inicial.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════
          § 2. VENTAS — De dónde provienen los ingresos
      ════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <SectionHeader
          title="Ventas"
          description="Origen de los ingresos · productos, canales y evolución"
          accent="income"
        />

        {/* Estructura de ingresos */}
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
        <p className="text-xs text-navy/30 -mt-3 flex items-center gap-1.5">
          <BookOpen size={12} className="shrink-0" />
          sales.csv · categoría (Suscripción / Paquete / Clase) y método de pago.
        </p>

        {/* Por producto y canal */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Block title="Por producto" legend="sales.csv · ticket medio = ingresos / ventas por producto.">
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

          <Block title="Por canal de pago" legend="sales.csv · método de pago registrado en cada transacción.">
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

        {/* Evolución */}
        <EvolucionChart sales={sales} />

        {/* Ocupación */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KpiCard label="Ocupación media" value={pct(occupancyRate(past30))} sub={`${past30.length} clases impartidas`} />
          <KpiCard label="Alumnos (30 días)" value={past30Students.toString()}
            sub={`Media ${past30.length > 0 ? (past30Students / past30.length).toFixed(1) : 0} por clase`} />
          <KpiCard label="Próximos 7 días"
            value={`${upcoming7.reduce((s, e) => s + e.ticketsSold, 0)} reservas`}
            sub={`${upcoming7.length} clases programadas`} />
        </div>
        <p className="text-xs text-navy/30 -mt-3 flex items-center gap-1.5">
          <BookOpen size={12} className="shrink-0" />
          Momence API · eventos activos de los últimos 30 días y próximos 7 días.
        </p>
      </section>

      {/* ════════════════════════════════════════════════════════
          § 3. FISCAL — Cumplimiento de obligaciones
      ════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <SectionHeader
          title="Fiscal"
          description="Obligaciones tributarias · estimaciones y fechas clave"
          accent="warning"
        />

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
      </section>

    </main>
  );
}
