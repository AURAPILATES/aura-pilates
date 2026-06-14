export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { BookOpen } from "react-feather";
import { fmt, pct } from "@/lib/analytics";
import { loadSales, salesByProduct } from "@/lib/sales";
import {
  loadStripePaymentsCached,
  stripeByMethod,
  totalRevenue as stripeTotalRevenue,
  revenueForMonth as stripeRevenueForMonth,
  toSales,
} from "@/lib/stripePayments";
import SyncStripeButton from "@/app/components/SyncStripeButton";
import {
  estimatedMRR,
  activeCustomersInMonth,
  recurringCustomerIds,
  possibleChurnIds,
} from "@/lib/stripeRecurrence";
import {
  loadTransactions,
  totalOperationalExpenses,
  totalStartupCosts,
  operationalExpensesByCategory,
} from "@/lib/transactions";
import { loadCategories } from "@/lib/categories";
import { getDateRange } from "@/lib/dateRange";
import DateFilter from "@/app/components/DateFilter";
import HealthCards from "./HealthCards";
import GastosBreakdown from "./GastosBreakdown";
import FinanzasBarChart from "./FinanzasBarChart";
import EvolucionChart from "./EvolucionChart";
import PresupuestosBlock from "./PresupuestosBlock";
import { loadBudgets, computeSpent } from "@/lib/budgets";

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

function KpiCard({ label, value, sub, trend, valueColor = "text-navy" }: {
  label: string; value: string; sub?: string; trend?: number | null; valueColor?: string;
}) {
  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs text-navy/55 uppercase tracking-wider leading-tight">{label}</p>
        {trend !== undefined && <TrendBadge value={trend ?? null} />}
      </div>
      <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-navy/55 mt-1">{sub}</p>}
    </div>
  );
}

function Block({ title, legend, children }: {
  title: string; legend?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
      <p className="text-xs font-semibold text-navy/55 uppercase tracking-wider mb-4">{title}</p>
      {children}
      {legend && (
        <p className="text-xs text-navy/45 mt-4 pt-3 border-t border-navy/5 leading-relaxed flex items-start gap-1.5">
          <BookOpen size={12} className="shrink-0 mt-0.5" />
          {legend}
        </p>
      )}
    </div>
  );
}

function QuestionHeader({ num, question }: { num: number; question: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-xs font-bold text-primary/50 tabular-nums w-4 shrink-0">{num}</span>
      <h2 className="text-xs font-semibold text-navy/50 uppercase tracking-widest">{question}</h2>
    </div>
  );
}

const PRODUCT_COLORS = ["#6B7ED6","#9260B8","#D4AA35","#4A7A9B","#4A9870","#D46055","#C46890","#3AA09C"];
const EXPENSE_COLORS = ["#6B7ED6","#9260B8","#D4AA35","#4A7A9B","#4A9870","#D46055","#C46890","#3AA09C","#8878C0"];
const BURN_CATS = new Set([
  "Alquiler","Salarios","Electricidad","Agua","Software","Gestoría y legal",
  "Impuestos y tasas","Teléfono","Seguros","Comisiones bancarias","Merchandising","Local","Otros",
]);

function pad2(n: number) { return String(n).padStart(2, "0"); }
const MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MES[parseInt(m, 10) - 1]} ${y}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function Finanzas(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const { from, to } = getDateRange(sp.range);

  // ── Stripe payments ──
  const now = new Date();
  const curMonth  = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${pad2(prevMonthDate.getMonth() + 1)}`;
  const prev2MonthDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const prev2Month = `${prev2MonthDate.getFullYear()}-${pad2(prev2MonthDate.getMonth() + 1)}`;

  const paymentsAll = await loadStripePaymentsCached();
  const payments = (from || to)
    ? paymentsAll.filter((p) => {
        if (from && p.date < from) return false;
        if (to   && p.date > to)   return false;
        return true;
      })
    : paymentsAll;
  const hasSales  = paymentsAll.length > 0;
  const totalRev  = stripeTotalRevenue(payments);

  const cur       = stripeRevenueForMonth(paymentsAll, curMonth);
  const prev      = stripeRevenueForMonth(paymentsAll, prevMonth);
  const curCount  = paymentsAll.filter((p) => p.date.startsWith(curMonth)).length;
  const prevCount = paymentsAll.filter((p) => p.date.startsWith(prevMonth)).length;


  const ticketMedio = payments.length > 0 ? totalRev / payments.length : 0;
  const ticketPrev  = prevCount > 0 ? prev / prevCount : 0;
  const ticketCur   = curCount > 0 ? cur / curCount : 0;

  // ── Recurrencia (derivada de pagos, no de suscripciones Stripe) ──
  const recurringIds    = recurringCustomerIds(paymentsAll, curMonth);
  const activeSubsCount = recurringIds.size;
  const realMrr         = estimatedMRR(paymentsAll, curMonth);
  const churnIds        = possibleChurnIds(paymentsAll, curMonth);
  const renewNext7      = activeCustomersInMonth(paymentsAll, curMonth);

  const recurrente    = payments.filter((p) => p.customerId && recurringIds.has(p.customerId)).reduce((s, p) => s + p.amount, 0);
  const recurrentePct = totalRev > 0 ? recurrente / totalRev : 0;
  const byMethod      = stripeByMethod(payments);
  const puntual       = totalRev - recurrente;

  // Convert to Sale[] for Momence-compatible charts
  const salesAll  = toSales(paymentsAll);

  // Momence CSV: fuente de verdad para desglose por producto
  const momenceSalesAll = loadSales();
  const momenceSales    = (from || to)
    ? momenceSalesAll.filter((s) => {
        if (from && s.paymentDate < from) return false;
        if (to   && s.paymentDate > to)   return false;
        return true;
      })
    : momenceSalesAll;
  const byProduct = salesByProduct(momenceSales).sort((a, b) => b.revenue - a.revenue);

  // ── Urban Sports Club: ingresos desde Momence CSV (USC paga por transferencia, no Stripe) ──
  const uscSales   = momenceSales.filter((s) => s.method === "urban-sports-club");
  const uscRevenue = uscSales.reduce((sum, s) => sum + s.amount, 0);
  const uscCount   = uscSales.length;
  const uscCur  = momenceSalesAll.filter((s) => s.method === "urban-sports-club" && s.paymentDate.startsWith(curMonth)).reduce((sum, s) => sum + s.amount, 0);
  const uscPrev = momenceSalesAll.filter((s) => s.method === "urban-sports-club" && s.paymentDate.startsWith(prevMonth)).reduce((sum, s) => sum + s.amount, 0);

  // ── Transactions (siempre datos completos — el banco solo exporta hasta fecha fija) ──
  const [txnsAll, dbCategories, budgets] = await Promise.all([loadTransactions(), loadCategories(), loadBudgets()]);
  const dbCatByLabel = new Map(dbCategories.map((c) => [c.label, c]));
  const totalOpEx     = totalOperationalExpenses(txnsAll);
  const totalStartup  = totalStartupCosts(txnsAll);
  const expByCategory = operationalExpensesByCategory(txnsAll);
  const totalExpCat   = expByCategory.reduce((s, r) => s + r.total, 0);

  // ── Budgets / Financiación ────────────────────────────────────────────────
  const budgetSpent = computeSpent(budgets, txnsAll);

  // Rango real de transacciones para mostrarlo en el desglose
  const txnDates = txnsAll.map((t) => t.date).sort();
  const txnRangeLabel = (() => {
    if (txnDates.length === 0) return null;
    const fmt3 = (d: string) => {
      const [y, m] = d.split("-");
      return `${MES[parseInt(m, 10) - 1].toLowerCase()} ${y}`;
    };
    const from3 = fmt3(txnDates[0]);
    const to3   = fmt3(txnDates[txnDates.length - 1]);
    return from3 === to3 ? from3 : `${from3} – ${to3}`;
  })();

  const transactionsByCategory: Record<string, { date: string; amount: number; concept: string; contact: string }[]> = {};
  for (const t of txnsAll) {
    if (!transactionsByCategory[t.category]) transactionsByCategory[t.category] = [];
    transactionsByCategory[t.category].push({ date: t.date, amount: t.amount, concept: t.concept ?? "", contact: t.contact ?? "" });
  }

  // ── Salud financiera (datos completos) ──
  const today_ym = curMonth;

  const currentBalance = [...txnsAll].sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null)?.balance ?? null;
  const balanceDate = [...txnsAll].sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null)?.date ?? null;

  const burnByMonth = new Map<string, number>();
  for (const t of txnsAll) {
    if (t.amount >= 0 || !BURN_CATS.has(t.category)) continue;
    const m = t.date.slice(0, 7);
    burnByMonth.set(m, (burnByMonth.get(m) ?? 0) + Math.abs(t.amount));
  }
  const completeBurnMonths = [...burnByMonth.keys()].filter((m) => m < today_ym).sort().reverse().slice(0, 3);
  const avgMonthlyBurn = completeBurnMonths.length > 0
    ? completeBurnMonths.reduce((s, m) => s + burnByMonth.get(m)!, 0) / completeBurnMonths.length
    : 0;

  const runwayMonths = currentBalance !== null && avgMonthlyBurn > 0
    ? currentBalance / avgMonthlyBurn : null;

  const revMonths = [...new Set([
    ...salesAll.map((s) => s.paymentDate.slice(0, 7)),
    ...momenceSalesAll.filter((s) => s.method === "urban-sports-club").map((s) => s.paymentDate.slice(0, 7)),
  ])].filter((m) => m < today_ym).sort().reverse().slice(0, 3);
  const avgMonthlyRevenue = revMonths.length > 0
    ? revMonths.reduce((s, m) => {
        const stripeRev = stripeRevenueForMonth(paymentsAll, m);
        const uscRev = momenceSalesAll.filter((sa) => sa.method === "urban-sports-club" && sa.paymentDate.startsWith(m)).reduce((sum, sa) => sum + sa.amount, 0);
        return s + stripeRev + uscRev;
      }, 0) / revMonths.length
    : 0;

  const breakEvenGap = avgMonthlyBurn - avgMonthlyRevenue;
  const clientesNecesarios = breakEvenGap > 0 && ticketMedio > 0
    ? Math.ceil(breakEvenGap / ticketMedio) : null;

  // Resultado mes estimado
  const curMonthBurnFromData = burnByMonth.get(curMonth) ?? 0;
  const estGastosMes  = curMonthBurnFromData > 0 ? curMonthBurnFromData : avgMonthlyBurn;
  const isGastosEst   = curMonthBurnFromData === 0;
  const resultadoMes  = (cur + uscCur) - estGastosMes;

  // ── Donut ──
  const R = 40; const CX = 50; const CY = 50;
  const CIRC = 2 * Math.PI * R;
  let offP = 0;
  const productSegments = byProduct.map((p, i) => {
    const share = totalRev > 0 ? p.revenue / totalRev : 0;
    const dash = share * CIRC;
    const offset = -offP;
    offP += dash;
    return { ...p, share, dash, offset, color: PRODUCT_COLORS[i % PRODUCT_COLORS.length] };
  });

  // ── Fiscal ──
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

  return (
    <div>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center justify-between gap-3">
          <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Finanzas</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <SyncStripeButton />
            <Suspense fallback={null}>
              <DateFilter />
            </Suspense>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-16">

        {!hasSales && (
          <div className="bg-warning/10 border border-warning/30 rounded p-4 text-sm text-warning mb-6">
            Sin datos de ventas. Copia el CSV de Momence a{" "}
            <code className="font-mono bg-warning/10 px-1 rounded text-xs">data/sales.csv</code>.
          </div>
        )}

        <HealthCards
          currentBalance={currentBalance}
          balanceDate={balanceDate}
          runwayMonths={runwayMonths}
          avgMonthlyBurn={avgMonthlyBurn}
          completeBurnMonthsCount={completeBurnMonths.length}
          resultadoMes={resultadoMes}
          breakEvenGap={breakEvenGap}
          avgMonthlyRevenue={avgMonthlyRevenue}
          clientesNecesarios={clientesNecesarios}
          curMonthLabel={monthLabel(curMonth)}
        />

        <div className="space-y-14">

            {/* Q1 ¿Cómo fue este mes? */}
            <section id="q1">
              <QuestionHeader num={1} question={`¿Cómo fue ${monthLabel(curMonth)}?`} />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <KpiCard
                    label={`Ingresos · ${monthLabel(curMonth)}`}
                    value={fmt(cur + uscCur)}
                    sub={uscCur > 0 ? `Stripe ${fmt(cur)} + USC ${fmt(uscCur)}` : `${curCount} transacciones`}
                    trend={trendPct(cur + uscCur, prev + uscPrev)}
                  />
                  <KpiCard
                    label={`Gastos · ${monthLabel(curMonth)}`}
                    value={fmt(estGastosMes)}
                    sub={isGastosEst ? "estimado" : `${txnsAll.filter(t => t.amount < 0 && t.date.startsWith(curMonth)).length} transacciones`}
                  />
                  <KpiCard
                    label="Resultado mes"
                    value={`${resultadoMes >= 0 ? "+" : "−"}${fmt(Math.abs(resultadoMes))}`}
                    sub="ingresos − gastos"
                    valueColor={resultadoMes >= 0 ? "text-success" : "text-danger"}
                  />
                  <KpiCard label="Clientes recurrentes" value={String(activeSubsCount)} sub={`MRR estimado ${fmt(realMrr)}`} />
                </div>
                <FinanzasBarChart sales={salesAll} txns={txnsAll} />
              </div>
            </section>

            {/* Q2 ¿En qué se va el dinero? */}
            <section id="q2">
              <QuestionHeader num={2} question="¿En qué se va el dinero?" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <KpiCard label="Gastos operativos" value={fmt(totalOpEx)} sub="costes recurrentes" />
                  <KpiCard label="Inversión inicial" value={fmt(totalStartup)} sub="reforma, maquinaria, mobiliario" />
                  <KpiCard label="Total acumulado" value={fmt(totalOpEx + totalStartup)}
                    sub={`${txnsAll.filter(t => t.amount < 0).length} transacciones`} />
                  <KpiCard
                    label="Ticket medio"
                    value={fmt(ticketMedio)}
                    sub={`${momenceSales.length} ventas totales`}
                    trend={trendPct(ticketCur, ticketPrev)}
                  />
                </div>
                <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
                  <div className="flex items-start justify-between mb-5">
                    <p className="text-xs font-semibold text-navy/55 uppercase tracking-wider">Desglose gastos operativos</p>
                    {txnRangeLabel && <p className="text-xs text-navy/45">{txnRangeLabel}</p>}
                  </div>
                  <GastosBreakdown
                    categories={expByCategory.map((e, i) => {
                      const dbCat = dbCatByLabel.get(e.category);
                      return {
                        ...e,
                        color: dbCat?.text_color ?? EXPENSE_COLORS[i % EXPENSE_COLORS.length],
                        iconKey: dbCat?.emoji,
                      };
                    })}
                    transactionsByCategory={transactionsByCategory}
                    totalExpCat={totalExpCat}
                    rangeLabel={txnRangeLabel}
                  />
                  <p className="text-xs text-navy/45 mt-4 pt-3 border-t border-navy/5 leading-relaxed flex items-start gap-1.5">
                    <BookOpen size={12} className="shrink-0 mt-0.5" />
                    exportación bancaria Caixabank · excluye aportaciones de socios, préstamo e inversión inicial.
                  </p>
                </div>
              </div>
            </section>

            {/* Q3 ¿De dónde vienen los ingresos? */}
            <section id="q3">
              <QuestionHeader num={3} question="¿De dónde vienen los ingresos?" />
              <div className="space-y-4">
                {/* Fuentes de ingresos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
                    <p className="text-xs text-navy/55 uppercase tracking-wider mb-1">Recurrentes</p>
                    <p className="text-[10px] text-navy/55 mb-2">{activeSubsCount} clientes · 2+ meses de 3</p>
                    <p className="text-3xl font-semibold text-primary">{fmt(recurrente)}</p>
                    <p className="text-xs text-navy/55 mt-1">{pct(recurrentePct)} del total</p>
                    <div className="mt-4 h-1.5 bg-navy/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: pct(recurrentePct) }} />
                    </div>
                  </div>
                  <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
                    <p className="text-xs text-navy/55 uppercase tracking-wider mb-3">Pagos únicos</p>
                    <p className="text-3xl font-semibold text-income">{fmt(puntual)}</p>
                    <p className="text-xs text-navy/55 mt-1">{pct(totalRev > 0 ? puntual / totalRev : 0)} del total</p>
                    <div className="mt-4 h-1.5 bg-navy/5 rounded-full overflow-hidden">
                      <div className="h-full bg-income rounded-full"
                        style={{ width: pct(totalRev > 0 ? puntual / totalRev : 0) }} />
                    </div>
                  </div>
                  <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
                    <p className="text-xs text-navy/55 uppercase tracking-wider mb-3">Retención</p>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-3xl font-semibold ${churnIds.size > 0 ? "text-warning" : "text-success"}`}>
                        {churnIds.size}
                      </p>
                      <p className="text-xs text-navy/55">sin pagar este mes</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-navy/5 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-navy/55">Activos este mes</span>
                        <span className="font-medium text-navy">{renewNext7}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-navy/55">MRR estimado</span>
                        <span className="font-medium text-navy">{fmt(realMrr)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-navy/45 flex items-center gap-1.5">
                  <BookOpen size={12} className="shrink-0" />
                  Stripe · pagos en tiempo real.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Block title="Por producto" legend="Momence · exportación CSV de ventas por producto.">
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
                                <p className="text-[10px] text-navy/55">{seg.count} ventas</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-medium text-navy tabular-nums">{fmt(seg.revenue)}</p>
                                <p className="text-[10px] text-navy/55 tabular-nums">{pct(seg.share)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : <p className="text-sm text-navy/45">Sin datos de productos.</p>}
                  </Block>
                  <Block title="Por canal de pago" legend="Stripe (cobros directos) + Urban Sports Club (Momence CSV · 11 €/clase).">
                    {(() => {
                      const combinedTotal = totalRev + uscRevenue;
                      const allRows = [
                        ...byMethod.map((r) => ({ key: r.method, label: r.label, revenue: r.revenue, count: r.count, bar: "bg-primary" })),
                        ...(uscRevenue > 0 ? [{ key: "usc", label: "Urban Sports Club", revenue: uscRevenue, count: uscCount, bar: "bg-warning" }] : []),
                      ];
                      return (
                        <>
                          <div className="space-y-4">
                            {allRows.map((row) => {
                              const share = combinedTotal > 0 ? row.revenue / combinedTotal : 0;
                              return (
                                <div key={row.key}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs text-navy">{row.label}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-navy/55 tabular-nums">{row.count} cobros</span>
                                      <span className="text-xs font-medium text-navy tabular-nums w-16 text-right">{fmt(row.revenue)}</span>
                                      <span className="text-xs text-navy/55 w-8 text-right tabular-nums">{pct(share)}</span>
                                    </div>
                                  </div>
                                  <div className="h-1.5 bg-navy/5 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${row.bar}`} style={{ width: pct(share) }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-4 pt-3 border-t border-navy/5 flex justify-between">
                            <span className="text-xs text-navy/55">Total período</span>
                            <span className="text-xs font-semibold text-navy">{fmt(combinedTotal)}</span>
                          </div>
                        </>
                      );
                    })()}
                  </Block>
                </div>
                <EvolucionChart sales={toSales(payments)} />
              </div>
            </section>

            {/* Q4 ¿Qué debo a Hacienda? */}
            <section id="q4">
              <QuestionHeader num={4} question="¿Qué debo a Hacienda y cuándo?" />
              <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
                <p className="text-xs font-semibold text-navy/55 uppercase tracking-wider mb-4">Próximas obligaciones</p>
                <div className="space-y-3">
                  {obligations.map(({ label, date, deadline }) => {
                    const days = daysUntil(deadline);
                    const badgeClass = days <= 30
                      ? "bg-danger/10 text-danger"
                      : days <= 60
                      ? "bg-warning/10 text-warning"
                      : "bg-navy/5 text-navy/55";
                    return (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-sm text-navy">{label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-navy/45 tabular-nums">
                            {daysUntil(deadline) <= 0 ? "vence hoy" : `${daysUntil(deadline)} días`}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeClass}`}>{date}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Q5 Financiación */}
            <section id="q5">
              <QuestionHeader num={5} question="¿Cómo va la financiación?" />
              <PresupuestosBlock initialBudgets={budgets} spent={budgetSpent} />
            </section>

        </div>
      </div>
    </div>
  );
}
