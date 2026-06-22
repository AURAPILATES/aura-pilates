import { BookOpen } from "react-feather";
import { fmt, pct } from "@/lib/analytics";
import { loadSales, benvingudaConversion, subscriberFirstPurchase, salesByProduct } from "@/lib/sales";
import PrimeraCompra from "./instances/PrimeraCompra";
import {
  loadStripePaymentsCached,
  loadPaymentsBreakdown,
  stripeByMethod,
  totalRevenue as stripeTotalRevenue,
  revenueForMonth as stripeRevenueForMonth,
  totalFees as stripeTotalFees,
  totalNet as stripeTotalNet,
  toSales,
  activeCustomersByMonth,
} from "@/lib/stripePayments";
import ClientesPaymentsBreakdown from "@/app/clientes/ClientesPaymentsBreakdown";
import {
  estimatedMRR,
  activeCustomersInMonth,
  recurringCustomerIds,
  possibleChurnIds,
} from "@/lib/stripeRecurrence";

import {
  loadTransactionsCached,
  totalOperationalExpenses,
  totalStartupCosts,
  expensesByCategoryAll,
  type EconomicGroup,
} from "@/lib/transactions";
import { loadCategoriesCached, type Category } from "@/lib/categories";
import DesglosGastos from "./instances/DesglosGastos";
import DesglosGastosGeneral from "./instances/DesglosGastosGeneral";
import ResumenFinanzas from "./instances/ResumenFinanzas";
import VolumenBruto from "./instances/VolumenBruto";
import FuentesIngreso from "./instances/FuentesIngreso";
import IngresosPorProducto from "./instances/IngresosPorProducto";
import EvolucionIngresos from "./instances/EvolucionIngresos";
import Financiacion from "./instances/Financiacion";
import { loadBudgetsCached, computeSpent } from "@/lib/budgets";
import Breakeven from "./instances/Breakeven";
import { computeBreakeven } from "@/lib/breakeven";
import ConversionPack from "./instances/ConversionPack";
import MrrPorTier from "./instances/MrrPorTier";
import { subscriptionTiersFromMemberships, computeMrrByTier } from "@/lib/mrr";
import { getMemberships, getProducts, getCustomers } from "@/lib/momence";
import { catalogFromMomence, revenueByProductFromStripe, revenueByProductByMonth, addUscToMonthlyRevenue } from "@/lib/productRevenue";
import { countActiveStudents, computeAltasMes, computeBasjasMes } from "@/lib/studentMetrics";
import { computeSubscriptionCohorts, computeRetentionCohorts } from "@/lib/subscriptionCohort";
import EvolucionSuscripciones from "./instances/EvolucionSuscripciones";
import EvolucionInscritos from "./instances/EvolucionInscritos";
import RetencionCohorte from "./instances/RetencionCohorte";
import QuestionHeader from "@/app/components/QuestionHeader";
import { loadBusinessEvents } from "@/lib/businessEvents";
import KpiTile from "@/components/charts/KpiTile";
import { pad2 } from "@/lib/periodCalculation";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const PRODUCT_COLORS = ["#6B7ED6","#9260B8","#D4AA35","#4A7A9B","#4A9870","#D46055","#C46890","#3AA09C"];
const EXPENSE_COLORS = ["#6B7ED6","#9260B8","#D4AA35","#4A7A9B","#4A9870","#D46055","#C46890","#3AA09C","#8878C0"];
const BURN_CATS = new Set([
  "Alquiler","Salarios","Seguridad social","Electricidad","Agua","Software","Gestoría y legal",
  "Impuestos y tasas","IVA","IRPF","IS","Teléfono","Seguros","Comisiones bancarias","Merchandising","Local","Otros",
]);

type LeafExpenseSeg = { value: string; label: string; count: number; total: number; color: string; iconKey?: string };
export type TopExpenseSeg = {
  key: string; label: string; color: string; iconKey?: string; group: EconomicGroup;
  count: number; total: number; children: LeafExpenseSeg[];
};

/** Agrupa el desglose de gastos (por categoría "hoja") bajo su categoría padre cuando tiene subcategorías. */
function groupExpensesByTopCategory(
  expByCategory: { category: string; count: number; total: number; group: EconomicGroup }[],
  dbCatByValue: Map<string, Category>,
  dbCatById: Map<string, Category>,
  fallbackColors: string[],
): TopExpenseSeg[] {
  const topMap = new Map<string, TopExpenseSeg>();
  expByCategory.forEach((e, i) => {
    const dbCat = dbCatByValue.get(e.category);
    const parent = dbCat?.parent_id ? dbCatById.get(dbCat.parent_id) : undefined;
    const topKey = parent?.value ?? dbCat?.value ?? e.category;

    if (!topMap.has(topKey)) {
      topMap.set(topKey, {
        key: topKey,
        label: parent?.label ?? dbCat?.label ?? e.category,
        color: parent?.text_color ?? dbCat?.text_color ?? fallbackColors[i % fallbackColors.length],
        iconKey: parent?.emoji ?? dbCat?.emoji,
        group: e.group,
        count: 0,
        total: 0,
        children: [],
      });
    }
    const top = topMap.get(topKey)!;
    top.count += e.count;
    top.total += e.total;
    if (parent && dbCat) {
      top.children.push({ value: e.category, label: dbCat.label, count: e.count, total: e.total, color: dbCat.text_color, iconKey: dbCat.emoji });
    }
  });
  const result = [...topMap.values()];
  for (const top of result) top.children.sort((a, b) => b.total - a.total);
  return result.sort((a, b) => b.total - a.total);
}

const ECON_GROUP_ORDER: EconomicGroup[] = ["personal", "operational", "capex"];

/** Totales por bloque económico (Personal / OpEx / CapEx), con sus transacciones, para la visión general del desglose de gastos. */
function groupExpensesByEconomicGroup(
  expByCategory: { category: string; count: number; total: number; group: EconomicGroup }[],
  transactionsByCategory: Record<string, { date: string; amount: number; concept: string; contact: string }[]>,
) {
  return ECON_GROUP_ORDER.map((group) => {
    const entries = expByCategory.filter((e) => e.group === group);
    return {
      group,
      total: entries.reduce((s, e) => s + e.total, 0),
      count: entries.reduce((s, e) => s + e.count, 0),
      txns: entries.flatMap((e) => transactionsByCategory[e.category] ?? []),
    };
  });
}

const MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MES[parseInt(m, 10) - 1]} ${y}`;
}

// ── Loader ────────────────────────────────────────────────────────────────────

type Props = {
  mainFrom: string;
  mainTo: string;
  compFrom: string;
  compTo: string;
  periodLabel: string;
  compDateRange: string;
};

export default async function FinanzasLoader({
  mainFrom, mainTo, compFrom, compTo, periodLabel, compDateRange,
}: Props) {
  // ── Stripe payments ──
  const now = new Date();
  const curMonth  = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${pad2(prevMonthDate.getMonth() + 1)}`;

  const breakdownFrom = mainFrom;
  const breakdownTo   = mainTo;

  const [paymentsAll, membershipsAll, productsAll, customersAll, breakdown] = await Promise.all([
    loadStripePaymentsCached(),
    getMemberships(),
    getProducts(),
    getCustomers(),
    loadPaymentsBreakdown(breakdownFrom, breakdownTo),
  ]);
  const payments = paymentsAll.filter((p) => {
    if (p.date < mainFrom) return false;
    if (p.date > mainTo)   return false;
    return true;
  });
  const hasSales  = paymentsAll.length > 0;
  const totalRev  = stripeTotalRevenue(payments);
  const stripeFees = stripeTotalFees(payments);
  const stripeNet  = stripeTotalNet(payments);

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
  const puntual       = totalRev - recurrente;

  // Convert to Sale[] for Momence-compatible charts
  const salesAll  = toSales(paymentsAll);

  // Momence CSV: solo se usa para lo histórico (breakeven, conversión del pack) y para
  // Urban Sports Club, que paga por transferencia bancaria y no tiene fuente en vivo.
  const momenceSalesAll = loadSales();
  const momenceSales    = momenceSalesAll.filter((s) => {
    if (s.paymentDate < mainFrom) return false;
    if (s.paymentDate > mainTo)   return false;
    return true;
  });

  // ── Productos más vendidos (período, datos Momence CSV) ──
  const topProducts = salesByProduct(momenceSales).filter((p) => p.item !== "Urban").slice(0, 5);
  const topProductsTotal = topProducts.reduce((s, p) => s + p.revenue, 0);

  // ── Urban Sports Club: ingresos desde Momence CSV (USC paga por transferencia, no Stripe) ──
  const uscSales   = momenceSales.filter((s) => s.method === "urban-sports-club");
  const uscRevenue = uscSales.reduce((sum, s) => sum + s.amount, 0);
  const uscCount   = uscSales.length;
  const uscCur  = momenceSalesAll.filter((s) => s.method === "urban-sports-club" && s.paymentDate.startsWith(curMonth)).reduce((sum, s) => sum + s.amount, 0);
  const uscPrev = momenceSalesAll.filter((s) => s.method === "urban-sports-club" && s.paymentDate.startsWith(prevMonth)).reduce((sum, s) => sum + s.amount, 0);

  // ── Comparativa por periodo ──
  const paymentsComp = paymentsAll.filter((p) => {
    if (p.date < compFrom) return false;
    if (p.date > compTo)   return false;
    return true;
  });
  const revComp    = stripeTotalRevenue(paymentsComp);
  const uscRevComp = momenceSalesAll.filter((s) =>
    s.method === "urban-sports-club" &&
    s.paymentDate >= compFrom &&
    s.paymentDate <= compTo
  ).reduce((sum, s) => sum + s.amount, 0);
  const q1Revenue = totalRev + uscRevenue;
  const q1RevComp = revComp + uscRevComp;
  const q1Label   = periodLabel;

  // Última fecha con datos reales de Urban (el CSV no se actualiza solo) — se usa para
  // acotar "Por producto" / "Por canal de pago" y que Stripe y Urban cubran el mismo periodo.
  const uscDates = momenceSalesAll.filter((s) => s.method === "urban-sports-club").map((s) => s.paymentDate);
  const uscLastDate = uscDates.length > 0 ? uscDates.sort().reverse()[0] : null;
  const uscLastDateLabel = uscLastDate ? uscLastDate.split("-").reverse().join("/") : null;

  const paymentsBounded = uscLastDate ? payments.filter((p) => p.date <= uscLastDate) : payments;
  const productCatalog = catalogFromMomence(membershipsAll, productsAll);
  const liveProductRevenue = revenueByProductFromStripe(paymentsBounded, productCatalog);
  const byProduct = [
    ...liveProductRevenue,
    ...(uscRevenue > 0 ? [{ item: "Urban", category: "Urban Sports Club", revenue: uscRevenue, count: uscCount }] : []),
  ].sort((a, b) => b.revenue - a.revenue);
  const byProductTotal = byProduct.reduce((s, p) => s + p.revenue, 0);

  const byMethodBounded = stripeByMethod(paymentsBounded);

  // ── Transactions (siempre datos completos — el banco solo exporta hasta fecha fija) ──
  const [txnsAll, dbCategories, budgets, businessEvents] = await Promise.all([
    loadTransactionsCached(), loadCategoriesCached(), loadBudgetsCached(), loadBusinessEvents(),
  ]);
  // Las transacciones guardan el `value` de la categoría (no el `label`, que puede cambiar
  // p.ej. al convertir "Electricidad" en la subcategoría "Luz"), así que el lookup va por value.
  const dbCatByValue = new Map(dbCategories.map((c) => [c.value, c]));
  const dbCatById = new Map(dbCategories.map((c) => [c.id, c]));
  const totalOpEx     = totalOperationalExpenses(txnsAll);
  const totalStartup  = totalStartupCosts(txnsAll);
  const expByCategory = expensesByCategoryAll(txnsAll);
  const totalExpCat   = expByCategory.reduce((s, r) => s + r.total, 0);

  // ── Budgets / Financiación ────────────────────────────────────────────────
  const budgetSpent = computeSpent(budgets, txnsAll);

  // ── Breakeven desde el inicio ────────────────────────────────────────────
  const breakevenPoints = computeBreakeven(paymentsAll, momenceSalesAll, txnsAll);

  // ── Conversión Pack Benvinguda 2x1 → Suscripción ──────────────────────────
  const conversionSummary = benvingudaConversion(momenceSalesAll);

  // ── ¿De dónde vienen los suscriptores? (primera compra) ───────────────────
  const firstPurchaseSummary = subscriberFirstPurchase(momenceSalesAll);

  // ── MRR/ARR por suscripción (suscriptores activos reales en Momence) ──────
  const subscriptionTiers = subscriptionTiersFromMemberships(membershipsAll);
  const mrrByTier = computeMrrByTier(customersAll, subscriptionTiers);

  // ── KPIs de alumnos ──────────────────────────────────────────────────────
  const todayIso        = now.toISOString().slice(0, 10);
  const alumnosActivos  = countActiveStudents(customersAll, todayIso);
  const altasMes        = computeAltasMes(paymentsAll, customersAll, curMonth);
  const bajasMes        = computeBasjasMes(paymentsAll, customersAll, todayIso);
  const facturacionPrev = mrrByTier.reduce((s, t) => s + t.mrr, 0);

  // ── Evolución de ingresos + altas/bajas/reactivaciones (histórico completo) ──
  const paymentsAllBounded = uscLastDate ? paymentsAll.filter((p) => p.date <= uscLastDate) : paymentsAll;
  const monthlyStripeRevenue = revenueByProductByMonth(paymentsAllBounded, productCatalog);
  const uscByMonth = new Map<string, number>();
  for (const s of momenceSalesAll) {
    if (s.method !== "urban-sports-club") continue;
    const m = s.paymentDate.slice(0, 7);
    uscByMonth.set(m, (uscByMonth.get(m) ?? 0) + s.amount);
  }
  const monthlyRevenue = addUscToMonthlyRevenue(monthlyStripeRevenue, uscByMonth);
  const subscriptionCohorts = computeSubscriptionCohorts(paymentsAllBounded, subscriptionTiers);
  const retentionCohorts = computeRetentionCohorts(paymentsAllBounded, subscriptionTiers);
  const activeCustomersData = activeCustomersByMonth(paymentsAllBounded);

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
    if (!t.category) continue;
    if (!transactionsByCategory[t.category]) transactionsByCategory[t.category] = [];
    transactionsByCategory[t.category].push({ date: t.date, amount: t.amount, concept: t.concept ?? "", contact: t.contact ?? "" });
  }

  // ── Desglose de gastos: visión general (Personal/OpEx/CapEx) vs. específico (Personal+OpEx) ──
  const expGroupTotals = groupExpensesByEconomicGroup(expByCategory, transactionsByCategory);
  const expByTopCategory = groupExpensesByTopCategory(expByCategory, dbCatByValue, dbCatById, EXPENSE_COLORS);
  const expByTopCategoryNoCapex = expByTopCategory.filter((c) => c.group !== "capex");
  const totalExpCatNoCapex = expGroupTotals.filter((g) => g.group !== "capex").reduce((s, g) => s + g.total, 0);

  // ── Salud financiera (datos completos) ──
  const today_ym = curMonth;

  const currentBalance = [...txnsAll].sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null)?.balance ?? null;
  const balanceDate = [...txnsAll].sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null)?.date ?? null;

  const burnByMonth = new Map<string, number>();
  for (const t of txnsAll) {
    if (t.amount >= 0 || !t.category || !BURN_CATS.has(t.category)) continue;
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

  const productSegments = byProduct.map((p, i) => {
    const share = byProductTotal > 0 ? p.revenue / byProductTotal : 0;
    return { ...p, share, color: PRODUCT_COLORS[i % PRODUCT_COLORS.length] };
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
    <>
      {!hasSales && (
        <div className="bg-warning/10 border border-warning/30 rounded p-4 text-sm text-warning mb-6">
          Sin datos de ventas. Copia el CSV de Momence a{" "}
          <code className="font-mono bg-warning/10 px-1 rounded text-xs">data/sales.csv</code>.
        </div>
      )}

      {/* ── KPIs principales ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <KpiTile label="Alumnos activos" value={alumnosActivos} sub="con suscripción o pack vigente" />
        <KpiTile
          label={`Altas · ${monthLabel(curMonth)}`}
          value={`+${altasMes.nuevos + altasMes.reactivados}`}
          valueClassName="text-success"
          sub={
            altasMes.nuevos === 0 && altasMes.reactivados === 0
              ? "sin altas este mes"
              : [
                  altasMes.nuevos > 0 ? `${altasMes.nuevos} nuevos` : null,
                  altasMes.reactivados > 0 ? `${altasMes.reactivados} reactivados` : null,
                ].filter(Boolean).join(" · ")
          }
        />
        <KpiTile
          label={`Bajas · ${monthLabel(curMonth)}`}
          value={bajasMes > 0 ? `−${bajasMes}` : "−0"}
          valueClassName={bajasMes > 0 ? "text-danger" : "text-navy/30"}
          sub="suscripciones sin renovar"
        />
        <KpiTile label="Facturación prevista" value={fmt(facturacionPrev)} sub="MRR · suscripciones activas" />
      </div>

      <div className="mb-8">
        <EvolucionInscritos data={activeCustomersData} />
      </div>

      <ResumenFinanzas
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
            <QuestionHeader num={1} question={`¿Cómo fue ${q1Label.toLowerCase()}?`} />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiTile
                  label={`Ingresos · ${q1Label}`}
                  value={fmt(q1Revenue)}
                  delta={{ cur: q1Revenue, prev: q1RevComp }}
                  compLabel={`vs ${fmt(q1RevComp)} (${compDateRange})`}
                />
                <KpiTile
                  label={`Gastos · ${monthLabel(curMonth)}`}
                  value={fmt(estGastosMes)}
                  sub={isGastosEst ? "estimado" : `${txnsAll.filter(t => t.amount < 0 && t.date.startsWith(curMonth)).length} transacciones`}
                />
                <KpiTile
                  label="Resultado mes"
                  value={`${resultadoMes >= 0 ? "+" : "−"}${fmt(Math.abs(resultadoMes))}`}
                  sub="ingresos − gastos"
                  valueClassName={resultadoMes >= 0 ? "text-success" : "text-danger"}
                />
                <KpiTile label="Clientes recurrentes" value={String(activeSubsCount)} sub={`MRR estimado ${fmt(realMrr)}`} />
              </div>
              <VolumenBruto sales={salesAll} txns={txnsAll} />
            </div>
          </section>

          {/* Q2 ¿En qué se va el dinero? */}
          <section id="q2">
            <QuestionHeader num={2} question="¿En qué se va el dinero?" />
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiTile label="Gastos operativos" value={fmt(totalOpEx)} sub="costes recurrentes" />
                <KpiTile label="Inversión inicial" value={fmt(totalStartup)} sub="reforma, maquinaria, mobiliario" />
                <KpiTile label="Total acumulado" value={fmt(totalOpEx + totalStartup)}
                  sub={`${txnsAll.filter(t => t.amount < 0).length} transacciones`} />
                <KpiTile
                  label="Ticket medio"
                  value={fmt(ticketMedio)}
                  delta={{ cur: ticketCur, prev: ticketPrev }}
                  compLabel={`${payments.length} pagos Stripe`}
                />
              </div>
              <DesglosGastosGeneral
                groups={expGroupTotals}
                totalExpCat={totalExpCat}
                rangeLabel={txnRangeLabel}
              />
              <DesglosGastos
                categories={expByTopCategoryNoCapex}
                transactionsByCategory={transactionsByCategory}
                totalExpCat={totalExpCatNoCapex}
                rangeLabel={txnRangeLabel}
              />
            </div>
          </section>

          {/* Q3 ¿De dónde vienen los ingresos? */}
          <section id="q3">
            <QuestionHeader num={3} question="¿De dónde vienen los ingresos?" />
            <div className="space-y-4">
              <FuentesIngreso
                recurrente={recurrente}
                puntual={puntual}
                totalRev={totalRev}
                stripeFees={stripeFees}
                stripeNet={stripeNet}
                paymentsCount={payments.length}
                activeSubsCount={activeSubsCount}
                periodLabel={periodLabel}
              />
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
              <ClientesPaymentsBreakdown
                succeeded={totalRev}
                refunded={breakdown.refunded}
                disputed={breakdown.disputed}
                failed={breakdown.failed}
                refundedIds={breakdown.refundedIds}
                disputedIds={breakdown.disputedIds}
                failedIds={breakdown.failedIds}
                periodLabel={periodLabel}
                excludeSegments={["failed"]}
              />
              <p className="text-xs text-navy/45 flex items-center gap-1.5">
                <BookOpen size={12} className="shrink-0" />
                Stripe · pagos en tiempo real.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <IngresosPorProducto
                  segments={productSegments.map((seg) => ({
                    item: seg.item, revenue: seg.revenue, count: seg.count, share: seg.share, color: seg.color,
                  }))}
                  total={byProductTotal}
                  rangeLabel={uscLastDateLabel ? `datos hasta ${uscLastDateLabel}` : undefined}
                />
                <Block title="Por canal de pago" legend={`Stripe en vivo + Urban Sports Club (Momence CSV)${uscLastDateLabel ? ` · datos hasta ${uscLastDateLabel}` : ""}.`}>
                  {(() => {
                    const cardRevenueBounded = stripeTotalRevenue(paymentsBounded);
                    const combinedTotal = cardRevenueBounded + uscRevenue;
                    const allRows = [
                      ...byMethodBounded.map((r) => ({ key: r.method, label: r.label, revenue: r.revenue, count: r.count, bar: "bg-primary" })),
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
                <Block title="Productos más vendidos" legend="Momence CSV · top 5 por ingresos del período.">
                  {topProducts.length === 0 ? (
                    <p className="text-sm text-navy/45">Sin datos de ventas</p>
                  ) : (
                    <div className="space-y-3">
                      {topProducts.map((p) => {
                        const share = topProductsTotal > 0 ? p.revenue / topProductsTotal : 0;
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
                </Block>
              </div>
              <EvolucionIngresos sales={toSales(payments)} monthly={monthlyRevenue} events={businessEvents} rawPayments={payments} />
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
            <Financiacion initialBudgets={budgets} spent={budgetSpent} />
          </section>

          {/* Q6 ¿Cuándo llegamos al breakeven? */}
          <section id="q6">
            <QuestionHeader num={6} question="¿Cuándo llegamos al breakeven?" />
            <Breakeven points={breakevenPoints} />
          </section>

          {/* Q7 ¿Convierte el pack de bienvenida? */}
          <section id="q7">
            <QuestionHeader num={7} question="¿Convierte el Pack Benvinguda 2x1?" />
            <ConversionPack summary={conversionSummary} />
          </section>

          {/* Q8 ¿Cuál es el MRR/ARR por suscripción? */}
          <section id="q8">
            <QuestionHeader num={8} question="¿Cuál es el MRR/ARR por suscripción?" />
            <MrrPorTier tiers={mrrByTier} />
          </section>

          {/* Q9 ¿Cómo evolucionan los ingresos y las altas/bajas? */}
          <section id="q9">
            <QuestionHeader num={9} question="¿Cómo evolucionan los ingresos y las altas/bajas?" />
            <div className="space-y-4">
              <EvolucionSuscripciones monthly={monthlyRevenue} cohorts={subscriptionCohorts} />
              <RetencionCohorte cohorts={retentionCohorts} />
            </div>
          </section>

          {/* Q10 ¿Cómo llegan los suscriptores? */}
          <section id="q10">
            <QuestionHeader num={10} question="¿Cómo llegan los suscriptores?" />
            <PrimeraCompra summary={firstPurchaseSummary} />
          </section>

      </div>
    </>
  );
}
