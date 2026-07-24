import { fmt, filterActive, occupancyRate, totalStudents } from "@/lib/analytics";
import { pctDelta } from "@/components/charts/DeltaBadge";
import { saveHistoricalEvents, loadHistoricalEvents } from "@/lib/history";
import { getLatestSyncRuns } from "@/lib/syncRuns";
import { taxBreakdown, fiscalQuarterOf, ivaRepercutidoFromGross, netIvaAPagar } from "@/lib/taxCalc";
import { loadSales, benvingudaConversion, subscriberFirstPurchase } from "@/lib/sales";
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
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { buildPrimaryIdMap, enrichCustomers, hasActiveSub } from "@/lib/customerEnrichment";
import { estimatedMRR } from "@/lib/stripeRecurrence";

import { loadTransactionsCached, expensesByCategoryAll, financingExpensesByCategory, getLatestImportDate, findCategory, type EconomicGroup, type Transaction } from "@/lib/transactions";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { loadCategoriesCached, NON_CASHFLOW_GROUP_TYPES, type Category } from "@/lib/categories";
import { loadRecurringExpensesCached, forecastConfirmedExpenses } from "@/lib/recurringExpenses";
import DesglosGastosUnificado from "./instances/DesglosGastosUnificado";
import IvaRetenciones from "./instances/IvaRetenciones";
import VentasPor from "./instances/VentasPor";
import type { IngresosPorFuenteRow } from "./instances/IngresosPorFuenteBody";
import EvolucionInscritos from "./instances/EvolucionInscritos";
import Financiacion from "./instances/Financiacion";
import { loadBudgetsCached, computeSpent } from "@/lib/budgets";
import Breakeven from "./instances/Breakeven";
import { computeBreakeven } from "@/lib/breakeven";
import ConversionPack from "./instances/ConversionPack";
import { subscriptionTiersFromMemberships } from "@/lib/mrr";
import { getMemberships, getProducts, getCustomers, getEvents } from "@/lib/momence";
import { catalogFromMomence, revenueByProductByMonth } from "@/lib/productRevenue";
import { computeSubscriptionCohorts, computeRetentionCohorts } from "@/lib/subscriptionCohort";
import RetencionCohorte from "./instances/RetencionCohorte";
import { loadBusinessEvents } from "@/lib/businessEvents";
import { loadPaymentErrorAcks, isPaymentErrorAcked } from "@/lib/paymentErrorAcks";
import { pad2 } from "@/lib/periodCalculation";
import AnaliticaKPIs from "./AnaliticaKPIs";
import ClientesPaymentsBreakdown from "@/app/clientes/ClientesPaymentsBreakdown";
import PrevisionGastos from "./PrevisionGastos";
import HorarioReporting from "./instances/HorarioReporting";
import VolumenBruto from "./instances/VolumenBruto";
import AnaliticaTabs from "./AnaliticaTabs";
import SectionHeader from "./SectionHeader";

// ── Helpers ───────────────────────────────────────────────────────────────────

const EXPENSE_COLORS = ["#6B7ED6","#9260B8","#D4AA35","#4A7A9B","#4A9870","#D46055","#C46890","#3AA09C","#8878C0"];
const BURN_CATS = new Set([
  "Alquiler","Salarios","Seguridad social","Electricidad","Agua","Software","Gestoría y legal",
  "Impuestos y tasas","IVA","IRPF","IS","Teléfono","Seguros","Comisiones bancarias","Merchandising","Local","Otros",
]);

export type LeafExpenseSeg = { value: string; label: string; count: number; total: number; color: string; iconKey?: string };
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

const ECON_GROUP_ORDER: EconomicGroup[] = ["personal", "operational", "financiacion", "capex"];

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

// ── Loader ────────────────────────────────────────────────────────────────────

type Props = {
  mainFrom: string;
  mainTo: string;
  compFrom: string;
  compTo: string;
  periodLabel: string;
  compDateRange: string;
};

export default async function AnaliticaLoader({
  mainFrom, mainTo, compFrom, compTo, periodLabel, compDateRange,
}: Props) {
  const now = new Date();
  const curMonth  = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  const [
    paymentsAll, membershipsAll, productsAll, customersAll,
    txnsAll, dbCategories, budgets, businessEvents, recurringExpenses, breakdown, breakdownComp,
    bancoLastImport, paymentErrorAcks, syncRuns, liveMomenceEvents, historicalMomenceEvents,
  ] = await Promise.all([
    loadStripePaymentsCached(),
    getMemberships(),
    getProducts(),
    getCustomers(),
    loadTransactionsCached(null, null),
    loadCategoriesCached(),
    loadBudgetsCached(),
    loadBusinessEvents(),
    loadRecurringExpensesCached(),
    loadPaymentsBreakdown(mainFrom, mainTo),
    loadPaymentsBreakdown(compFrom, compTo),
    getLatestImportDate(),
    loadPaymentErrorAcks(),
    getLatestSyncRuns().catch(() => null),
    getEvents(),
    loadHistoricalEvents(),
  ]);
  await saveHistoricalEvents(liveMomenceEvents);

  const allMomenceEventsById = new Map(historicalMomenceEvents.map((e) => [e.id, e]));
  liveMomenceEvents.forEach((e) => allMomenceEventsById.set(e.id, e));
  const allMomenceEvents = Array.from(allMomenceEventsById.values());
  const mainEvents = filterActive(allMomenceEvents).filter((e) => {
    const d = new Date(e.dateTime);
    return d >= new Date(mainFrom + "T00:00:00") && d <= new Date(mainTo + "T23:59:59");
  });
  const compEvents = filterActive(allMomenceEvents).filter((e) => {
    const d = new Date(e.dateTime);
    return d >= new Date(compFrom + "T00:00:00") && d <= new Date(compTo + "T23:59:59");
  });
  const occupancyAvg = occupancyRate(mainEvents);
  const avgPerClass  = mainEvents.length > 0 ? totalStudents(mainEvents) / mainEvents.length : 0;
  const occupancyAvgComp = occupancyRate(compEvents);
  const avgPerClassComp  = compEvents.length > 0 ? totalStudents(compEvents) / compEvents.length : 0;

  // La carga en vivo de Momence puede ir bien aunque el snapshot nocturno haya fallado
  // (p.ej. token caducado a las 3am) - eso afectaría a métricas de bajas/altas que
  // dependen de esos snapshots históricos, sin que la página en sí falle.
  const failedSyncRun = syncRuns
    ? ([syncRuns.momence_events, syncRuns.momence_subscribers].find((r) => r && !r.ok) ?? null)
    : null;

  // Stripe/Momence se leen en vivo en cada carga; el banco depende de la última subida manual de CSV.
  const liveLastUpdated = formatRelativeTime(now.toISOString());
  const bancoLastUpdated = formatRelativeTime(bancoLastImport);

  // Mapa stripeId → cliente fusionado por email, para agrupar cohortes/clientes por persona real
  const stripeCustomersAll = await loadStripeCustomers(paymentsAll, curMonth);
  const primaryIdMap = buildPrimaryIdMap(stripeCustomersAll);

  const pMain = paymentsAll.filter((p) => p.date >= mainFrom && p.date <= mainTo);
  const pComp = paymentsAll.filter((p) => p.date >= compFrom && p.date <= compTo);
  const txnsMain = txnsAll.filter((t) => t.date >= mainFrom && t.date <= mainTo);
  const txnsComp = txnsAll.filter((t) => t.date >= compFrom && t.date <= compTo);

  const hasSales  = paymentsAll.length > 0;
  const totalRev  = stripeTotalRevenue(pMain);
  const stripeFees = stripeTotalFees(pMain);
  const stripeNet  = stripeTotalNet(pMain);

  const ticketMedio = pMain.length > 0 ? totalRev / pMain.length : 0;

  // ── Recurrencia (derivada de pagos, no de suscripciones Stripe) ──
  const realMrr = estimatedMRR(paymentsAll, curMonth);

  const salesAll = toSales(paymentsAll);

  // Momence CSV: export manual, ya no se actualiza en tiempo real. Solo se usa para
  // Urban Sports Club (paga por transferencia bancaria, sin fuente en vivo) y para
  // breakeven histórico. Conversión del pack y "de dónde vienen los suscriptores" usan
  // salesAll (Stripe + producto inferido por importe, igual que en Clientes) - en vivo.
  const momenceSalesAll = loadSales();

  // ── Urban Sports Club: ingresos desde Momence CSV (USC paga por transferencia, no Stripe) ──
  const uscSales   = momenceSalesAll.filter((s) => s.method === "urban-sports-club" && s.paymentDate >= mainFrom && s.paymentDate <= mainTo);
  const uscRevenue = uscSales.reduce((sum, s) => sum + s.amount, 0);
  const uscCount   = uscSales.length;
  const revComp    = stripeTotalRevenue(pComp);
  const stripeFeesComp = stripeTotalFees(pComp);
  const uscRevComp = momenceSalesAll.filter((s) =>
    s.method === "urban-sports-club" &&
    s.paymentDate >= compFrom &&
    s.paymentDate <= compTo
  ).reduce((sum, s) => sum + s.amount, 0);
  const q1Revenue = totalRev + uscRevenue;
  const q1RevComp = revComp + uscRevComp;

  // Última fecha con datos reales de Urban (el CSV no se actualiza solo) - se usa para
  // acotar "Por producto" / "Por canal de pago" y que Stripe y Urban cubran el mismo periodo.
  const uscDates = momenceSalesAll.filter((s) => s.method === "urban-sports-club").map((s) => s.paymentDate);
  const uscLastDate = uscDates.length > 0 ? uscDates.sort().reverse()[0] : null;
  const uscLastDateLabel = uscLastDate ? uscLastDate.split("-").reverse().join("/") : null;

  const paymentsBounded = uscLastDate ? pMain.filter((p) => p.date <= uscLastDate) : pMain;
  const productCatalog = catalogFromMomence(membershipsAll, productsAll);

  const byMethodBounded = stripeByMethod(paymentsBounded);

  // Las transacciones guardan el `value` de la categoría (no el `label`, que puede cambiar
  // p.ej. al convertir "Electricidad" en la subcategoría "Luz"), así que el lookup va por value.
  const dbCatByValue = new Map(dbCategories.map((c) => [c.value, c]));
  const dbCatById = new Map(dbCategories.map((c) => [c.id, c]));
  const expByCategory = expensesByCategoryAll(txnsMain, dbCategories);

  // ── Budgets / Financiación ────────────────────────────────────────────────
  const budgetSpent = computeSpent(budgets, txnsAll);

  // ── Breakeven desde el inicio ────────────────────────────────────────────
  const breakevenPoints = computeBreakeven(paymentsAll, momenceSalesAll, txnsAll, dbCategories);

  // ── Conversión Pack Benvinguda 2x1 → Suscripción ──────────────────────────
  const conversionSummary = benvingudaConversion(salesAll);

  // ── ¿De dónde vienen los suscriptores? (primera compra) ───────────────────
  const firstPurchaseSummary = subscriberFirstPurchase(salesAll);

  // ── MRR/ARR por suscripción (suscriptores activos reales en Momence) ──────
  const subscriptionTiers = subscriptionTiersFromMemberships(membershipsAll);
  // ── Evolución de ingresos + altas/bajas/reactivaciones (histórico completo, solo Stripe) ──
  // Antes se recortaba TODO paymentsAll a uscLastDate "para que Stripe y Urban cubran el mismo
  // período" - pero estos tres usos son 100% Stripe (Urban no aparece en ninguno), así que ese
  // recorte solo servía para tirar datos de Stripe recientes cada vez que el CSV manual de Urban
  // se quedaba desactualizado. Solo "Ingresos por fuente" (más abajo) compara Stripe vs. Urban de
  // verdad, así que es el único que sigue acotado a uscLastDate.
  const monthlyStripeRevenue = revenueByProductByMonth(paymentsAll, productCatalog);
  const uscByMonth = new Map<string, number>();
  for (const s of momenceSalesAll) {
    if (s.method !== "urban-sports-club") continue;
    const m = s.paymentDate.slice(0, 7);
    uscByMonth.set(m, (uscByMonth.get(m) ?? 0) + s.amount);
  }

  // Ingresos por fuente: bruto, comisión y neto de Stripe por mes + USC neto. Stripe muestra
  // su histórico completo y real (sin recortar a uscLastDate) - Urban depende de un CSV manual
  // que se queda atrás, pero eso no debe ocultar ingresos de Stripe ya confirmados. La tarjeta
  // avisa por su cuenta de hasta cuándo llegan los datos de Urban (ver uscLastDateLabel).
  const monthlyStripeGrossMap = new Map<string, number>();
  const monthlyStripeFeesMap  = new Map<string, number>();
  const monthlyStripeNetMap   = new Map<string, number>();
  for (const p of paymentsAll) {
    const m = p.date.slice(0, 7);
    monthlyStripeGrossMap.set(m, (monthlyStripeGrossMap.get(m) ?? 0) + p.amount);
    monthlyStripeFeesMap.set(m,  (monthlyStripeFeesMap.get(m)  ?? 0) + p.fee);
    monthlyStripeNetMap.set(m,   (monthlyStripeNetMap.get(m)   ?? 0) + p.net);
  }
  const allMonthsFuente = new Set([...monthlyStripeNetMap.keys(), ...uscByMonth.keys()]);
  const MONTH_ES_F: Record<string, string> = { "01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun","07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic" };
  const monthlyByFuente: IngresosPorFuenteRow[] = Array.from(allMonthsFuente).sort().map((m) => {
    const [y, mm] = m.split("-");
    return {
      month: m,
      label: `${MONTH_ES_F[mm] ?? mm}'${y.slice(2)}`,
      stripeGross: monthlyStripeGrossMap.get(m) ?? 0,
      stripeFees:  monthlyStripeFeesMap.get(m)  ?? 0,
      stripeNet:   monthlyStripeNetMap.get(m)   ?? 0,
      uscNet:      uscByMonth.get(m)            ?? 0,
    };
  });

  const subscriptionCohorts = computeSubscriptionCohorts(paymentsAll, subscriptionTiers, primaryIdMap);
  const retentionCohorts = computeRetentionCohorts(paymentsAll, subscriptionTiers, 4, primaryIdMap);

  const transactionsByCategory: Record<string, { date: string; amount: number; concept: string; contact: string }[]> = {};
  for (const t of txnsMain) {
    if (!t.category) continue;
    // Las categorías de tipo "transfer" (Financiación) también incluyen la entrada del propio
    // préstamo (importe positivo) - eso no es un gasto y no debe colarse en el gráfico/drawer
    // de Desglose de gastos, así que aquí solo cuentan los pagos (importe negativo).
    const cat = findCategory(dbCategories, t.category);
    if (cat?.group_type === "transfer" && t.amount >= 0) continue;
    if (!transactionsByCategory[t.category]) transactionsByCategory[t.category] = [];
    transactionsByCategory[t.category].push({ date: t.date, amount: t.amount, concept: t.concept ?? "", contact: t.contact ?? "" });
  }

  // ── Financiación dentro del desglose de gastos: expensesByCategoryAll excluye a propósito
  // las categorías de tipo "transfer" (Financiación) para no mezclarlas con traspasos internos
  // reales - pero si una transacción SÍ tiene esa categoría asignada (p.ej. cuotas de préstamo),
  // es un gasto real y debe contar aparte, con su propio grupo en vez de en Operativo. ──
  const financingByCategory = financingExpensesByCategory(txnsMain, dbCategories);
  const allExpCategories = [...expByCategory, ...financingByCategory];

  // ── Desglose de gastos: visión general (Personal/OpEx/Financiación/CapEx) vs. específico (Personal+OpEx) ──
  const expGroupTotals = groupExpensesByEconomicGroup(allExpCategories, transactionsByCategory);
  const expByTopCategory = groupExpensesByTopCategory(allExpCategories, dbCatByValue, dbCatById, EXPENSE_COLORS);
  const totalExpCat = allExpCategories.reduce((s, r) => s + r.total, 0);

  // Mismo cálculo sobre el período de comparación, solo para el delta del KPI - no hace
  // falta el desglose por categoría/grupo, solo el total.
  const totalExpCatComp =
    expensesByCategoryAll(txnsComp, dbCategories).reduce((s, r) => s + r.total, 0) +
    financingExpensesByCategory(txnsComp, dbCategories).reduce((s, r) => s + r.total, 0);

  // ── Salud financiera (datos completos) ──
  const today_ym = curMonth;

  const burnByMonth = new Map<string, number>();
  const suministrosByMonth = new Map<string, number>();
  const incomeByMonth = new Map<string, number>();
  const expenseByMonth = new Map<string, number>();
  const SUMINISTROS_CATS = new Set(["Electricidad", "Agua"]);
  for (const t of txnsAll) {
    const cat = t.category ? findCategory(dbCategories, t.category) : undefined;
    const m = t.date.slice(0, 7);
    const isCashflow = !cat || !NON_CASHFLOW_GROUP_TYPES.has(cat.group_type);

    if (t.amount >= 0) {
      if (isCashflow) {
        incomeByMonth.set(m, (incomeByMonth.get(m) ?? 0) + t.amount);
      }
      continue;
    }
    if (isCashflow) {
      expenseByMonth.set(m, (expenseByMonth.get(m) ?? 0) + Math.abs(t.amount));
    }
    if (!t.category) continue;
    if (BURN_CATS.has(t.category)) {
      burnByMonth.set(m, (burnByMonth.get(m) ?? 0) + Math.abs(t.amount));
    }
    if (SUMINISTROS_CATS.has(t.category)) {
      suministrosByMonth.set(m, (suministrosByMonth.get(m) ?? 0) + Math.abs(t.amount));
    }
  }
  const complSuministrosMths = [...suministrosByMonth.keys()].filter((m) => m < today_ym).sort().reverse().slice(0, 3);
  const avgSuministros = complSuministrosMths.length > 0
    ? Math.round(complSuministrosMths.reduce((s, m) => s + suministrosByMonth.get(m)!, 0) / complSuministrosMths.length)
    : 0;
  const completeBurnMonths = [...burnByMonth.keys()].filter((m) => m < today_ym).sort().reverse().slice(0, 3);
  const avgMonthlyBurn = completeBurnMonths.length > 0
    ? completeBurnMonths.reduce((s, m) => s + burnByMonth.get(m)!, 0) / completeBurnMonths.length
    : 0;

  // Previsión de ingresos: media de los últimos 3 meses completos según el banco (mismo
  // criterio que Flujo de caja), no según Stripe/Momence - así ambos bloques hablan del
  // mismo dinero real y no de una estimación de venta que puede no haberse cobrado aún.
  const revMonths = [...incomeByMonth.keys()].filter((m) => m < today_ym).sort().reverse().slice(0, 3);
  const avgMonthlyRevenue = revMonths.length > 0
    ? revMonths.reduce((s, m) => s + (incomeByMonth.get(m) ?? 0), 0) / revMonths.length
    : 0;

  // Margen mensual de Flujo de caja: mismo criterio (ingresos y gastos brutos según el
  // banco) que el propio gráfico, medido sobre los últimos 3 meses completos.
  const avgMonthlyExpense = revMonths.length > 0
    ? revMonths.reduce((s, m) => s + (expenseByMonth.get(m) ?? 0), 0) / revMonths.length
    : 0;
  const avgMonthlyMargin = avgMonthlyRevenue - avgMonthlyExpense;

  // Margen del período seleccionado en el filtro (vs. el período de comparación), mismo
  // criterio de "según el banco" que el resto de Flujo de caja.
  function cashflowNet(txns: Transaction[]): number {
    let net = 0;
    for (const t of txns) {
      const cat = t.category ? findCategory(dbCategories, t.category) : undefined;
      if (cat && NON_CASHFLOW_GROUP_TYPES.has(cat.group_type)) continue;
      net += t.amount;
    }
    return net;
  }
  const periodMargin = cashflowNet(txnsMain);
  const periodMarginComp = cashflowNet(txnsComp);

  const breakEvenGap = avgMonthlyBurn - avgMonthlyRevenue;
  const clientesNecesarios = breakEvenGap > 0 && ticketMedio > 0
    ? Math.ceil(breakEvenGap / ticketMedio) : null;

  // ── Fiscal ──
  const today = new Date();
  const daysUntil = (d: string) =>
    Math.ceil((new Date(d).getTime() - today.getTime()) / 86_400_000);
  const obligations = [
    { label: "IVA T2",         date: "20 jul", deadline: "2026-07-20", quarter: "2026-Q2" },
    { label: "IRPF T2",        date: "20 jul", deadline: "2026-07-20", quarter: "2026-Q2" },
    { label: "IVA T3",         date: "20 oct", deadline: "2026-10-20", quarter: "2026-Q3" },
    { label: "IRPF T3",        date: "20 oct", deadline: "2026-10-20", quarter: "2026-Q3" },
    { label: "IVA T4 / Anual", date: "20 ene", deadline: "2027-01-20", quarter: "2026-Q4" },
  ];

  // ── IVA soportado / retenciones practicadas por trimestre, a partir de las reglas de
  // contacto (Configuración → Contactos) aplicadas en cada movimiento al importarlo ──
  const fiscalByQuarter = new Map<string, { iva: number; retencion: number; count: number }>();
  for (const t of txnsAll) {
    if (!t.iva_rate && !t.retencion_rate) continue;
    const { ivaAmount, retencionAmount } = taxBreakdown(t.amount, t.iva_rate ?? 0, t.retencion_rate ?? 0);
    const q = fiscalQuarterOf(t.date);
    const acc = fiscalByQuarter.get(q) ?? { iva: 0, retencion: 0, count: 0 };
    acc.iva += ivaAmount;
    acc.retencion += retencionAmount;
    acc.count += 1;
    fiscalByQuarter.set(q, acc);
  }
  // ── IVA repercutido por trimestre, a partir de las ventas (Stripe + USC), que ya
  // incluyen el 21% de IVA en el importe bruto ──
  const ivaRepercutidoByQuarter = new Map<string, number>();
  for (const p of paymentsAll) {
    const q = fiscalQuarterOf(p.date);
    ivaRepercutidoByQuarter.set(q, (ivaRepercutidoByQuarter.get(q) ?? 0) + ivaRepercutidoFromGross(p.amount));
  }
  for (const s of momenceSalesAll) {
    if (s.method !== "urban-sports-club") continue;
    const q = fiscalQuarterOf(s.paymentDate);
    ivaRepercutidoByQuarter.set(q, (ivaRepercutidoByQuarter.get(q) ?? 0) + ivaRepercutidoFromGross(s.amount));
  }

  // ── Resumen fiscal por trimestre: IVA neto a pagar (repercutido − soportado) + retenciones ──
  const allFiscalQuarters = new Set([...fiscalByQuarter.keys(), ...ivaRepercutidoByQuarter.keys()]);
  const fiscalSummaryByQuarter = new Map(
    [...allFiscalQuarters].map((q) => {
      const gasto = fiscalByQuarter.get(q) ?? { iva: 0, retencion: 0, count: 0 };
      const ivaRepercutido = ivaRepercutidoByQuarter.get(q) ?? 0;
      return [q, {
        ivaRepercutido,
        ivaSoportado: gasto.iva,
        ivaNeto: netIvaAPagar(ivaRepercutido, gasto.iva),
        retenciones: gasto.retencion,
      }];
    }),
  );

  // Próxima obligación de IVA (la primera con vencimiento futuro o "vence hoy") y si su
  // trimestre ya cerró (cifra real) o sigue en curso (cifra parcial, sin extrapolar).
  function quarterEndDate(q: string): string {
    const [y, qn] = q.split("-Q");
    const endMonth = parseInt(qn, 10) * 3;
    const lastDay = new Date(parseInt(y, 10), endMonth, 0).getDate();
    return `${y}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }
  const todayStr = today.toISOString().slice(0, 10);
  const nextIvaObligation = obligations.find((o) => o.label.startsWith("IVA") && o.deadline >= todayStr) ?? null;
  const nextIvaQuarterData = nextIvaObligation
    ? fiscalSummaryByQuarter.get(nextIvaObligation.quarter) ?? { ivaRepercutido: 0, ivaSoportado: 0, ivaNeto: 0, retenciones: 0 }
    : null;
  const nextIvaQuarterClosed = nextIvaObligation ? todayStr > quarterEndDate(nextIvaObligation.quarter) : false;

  const MESES_LARGO = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const nextIvaDueLabelLong = nextIvaObligation
    ? (() => { const [y, m] = nextIvaObligation.deadline.split("-"); return `${MESES_LARGO[parseInt(m, 10) - 1]} de ${y}`; })()
    : "-";
  const nextIvaQuarterLabel = nextIvaObligation
    ? (() => { const [y, qn] = nextIvaObligation.quarter.split("-Q"); return `T${qn} ${y}`; })()
    : "-";

  // Mismo resumen que fiscalSummaryByQuarter pero como lista ordenada (más reciente primero)
  // para la tabla "por trimestre" de IvaRetenciones.
  const quarterlyFiscalRows = [...fiscalSummaryByQuarter.entries()]
    .map(([quarter, v]) => ({ quarter, ...v }))
    .sort((a, b) => b.quarter.localeCompare(a.quarter))
    .slice(0, 6);

  // ── Clientela (composición, altas, riesgo de baja) ───────────────────────
  const recurringForecasts = forecastConfirmedExpenses(recurringExpenses, txnsAll, undefined, dbCategories);

  const firstPaymentMap = new Map<string, string>();
  for (const p of paymentsAll) {
    if (!p.customerId) continue;
    const ex = firstPaymentMap.get(p.customerId);
    if (!ex || p.date < ex) firstPaymentMap.set(p.customerId, p.date);
  }
  // Solo cuenta como "nuevo" si tiene un único perfil de Stripe bajo su email
  const mainNewCustomerIds = new Set(
    stripeCustomersAll
      .filter((c) => {
        if (c.stripeIds.length !== 1) return false;
        const firstDate = firstPaymentMap.get(c.stripeIds[0]);
        return !!firstDate && firstDate >= mainFrom && firstDate <= mainTo;
      })
      .map((c) => c.id),
  );

  const mainPayerIds = new Set(pMain.filter((p) => p.customerId).map((p) => p.customerId!));

  const customersRaw = enrichCustomers(stripeCustomersAll, paymentsAll, {
    activeIds: mainPayerIds,
    newCustomerIds: mainNewCustomerIds,
  });

  // Si ya se marcó "hablado con clienta" para este error y no ha fallado un cobro más
  // reciente desde entonces, deja de contar como error de pago pendiente.
  const customers = customersRaw.map((c) =>
    c.hasPaymentError && isPaymentErrorAcked(paymentErrorAcks.get(c.id), c.paymentErrorDate)
      ? { ...c, hasPaymentError: false }
      : c,
  );

  // ── Activos por email, deduplicados ──
  const payingCustomers = customers.filter((c) => c.stripeIds.some((sid) => mainPayerIds.has(sid)));

  const activeCount   = payingCustomers.length;
  const spendPerClient = activeCount > 0 ? totalRev / activeCount : 0;

  const compPayerIds = new Set(pComp.filter((p) => p.customerId).map((p) => p.customerId!));
  const payingCustomersComp = customers.filter((c) => c.stripeIds.some((sid) => compPayerIds.has(sid)));
  const activeCountComp = payingCustomersComp.length;
  const spendPerClientComp = activeCountComp > 0 ? revComp / activeCountComp : 0;

  // ── Clientes por convertir a suscripción: 2+ packs (sin contar Benvinguda), sin sub activa ──
  const packCounts = new Map<string, number>();
  for (const p of paymentsAll) {
    if (p.inferredType !== "pack" || p.inferredProduct === "Pack Benvinguda" || !p.customerId) continue;
    packCounts.set(p.customerId, (packCounts.get(p.customerId) ?? 0) + 1);
  }
  function packCountForCustomer(c: { stripeIds: string[] }): number {
    return c.stripeIds.reduce((s, sid) => s + (packCounts.get(sid) ?? 0), 0);
  }
  const convertCandidates = customers.filter(
    (c) => packCountForCustomer(c) >= 2 && !hasActiveSub(c),
  );

  const activeCustomersData = activeCustomersByMonth(paymentsAll);

  return (
    <>
      {!hasSales && (
        <div className="bg-warning/10 border border-warning/30 rounded-[10px] p-4 text-sm text-warning mb-6">
          Sin datos de ventas. Copia el CSV de Momence a{" "}
          <code className="font-mono bg-warning/10 px-1 rounded text-xs">data/sales.csv</code>.
        </div>
      )}

      {failedSyncRun && (
        <div className="bg-danger/10 border border-danger/30 rounded-[10px] p-4 text-sm text-danger mb-6">
          📌 El último snapshot nocturno de Momence falló ({formatRelativeTime(failedSyncRun.ranAt)}): {failedSyncRun.error}.
          Las métricas de altas/bajas de suscripción pueden estar desactualizadas hasta el próximo sync.
        </div>
      )}

      <AnaliticaTabs
        ingresosGastos={
          <section>
            <SectionHeader id="ingresos-gastos" title="Ingresos y gastos" />
            <div className="space-y-4">
              <VolumenBruto
                txns={txnsMain}
                categories={dbCategories}
                lastUpdated={bancoLastUpdated}
                dateRange={periodLabel}
                kpiItems={[
                  { label: "Margen del período", value: fmt(periodMargin), delta: pctDelta(periodMargin, periodMarginComp) },
                  { label: "Margen mensual", value: fmt(avgMonthlyMargin), helper: "media últimos 3 m" },
                ]}
              />
              <VentasPor
                stripeGross={totalRev}
                stripeFees={stripeFees}
                stripeNet={stripeNet}
                uscGross={uscRevenue}
                stripeGrossComp={revComp}
                stripeFeesComp={stripeFeesComp}
                uscGrossComp={uscRevComp}
                monthly={monthlyByFuente}
                dateRange={periodLabel}
                uscLastDateLabel={uscLastDateLabel}
                lastUpdated={uscLastDateLabel ? `Urban al día ${uscLastDateLabel}` : liveLastUpdated}
                monthlyProducto={monthlyStripeRevenue}
                cohorts={subscriptionCohorts}
                events={businessEvents}
                rawPayments={pMain}
              />
              <DesglosGastosUnificado
                groups={expGroupTotals}
                categories={expByTopCategory}
                transactionsByCategory={transactionsByCategory}
                totalExpCat={totalExpCat}
                totalExpCatComp={totalExpCatComp}
                rangeLabel={periodLabel}
                lastUpdated={bancoLastUpdated}
              />
              <PrevisionGastos forecasts={recurringForecasts} categories={dbCategories} avgSuministros={avgSuministros} />
              <Financiacion initialBudgets={budgets} spent={budgetSpent} />
              <Breakeven points={breakevenPoints} lastUpdated={bancoLastUpdated} />
              <IvaRetenciones
                quarterLabel={nextIvaQuarterLabel}
                ivaRepercutido={nextIvaQuarterData?.ivaRepercutido ?? 0}
                ivaSoportado={nextIvaQuarterData?.ivaSoportado ?? 0}
                ivaNeto={nextIvaQuarterData?.ivaNeto ?? 0}
                retenciones={nextIvaQuarterData?.retenciones ?? 0}
                dueLabel={nextIvaDueLabelLong}
                quarterClosed={nextIvaQuarterClosed}
                obligations={obligations
                  .map(({ label, deadline }) => ({ label, deadline, days: daysUntil(deadline) }))
                  .filter((o) => o.days >= 0)}
                rows={quarterlyFiscalRows}
                lastUpdated={bancoLastUpdated}
              />
            </div>
          </section>
        }
        clientes={
          <section>
            <SectionHeader id="clientes" title="Clientes" />
            <div className="space-y-4">
              <AnaliticaKPIs
                customers={customers}
                convertCandidates={convertCandidates}
                spendPerClient={spendPerClient}
                occupancyAvg={occupancyAvg}
                avgPerClass={avgPerClass}
                spendPerClientComp={spendPerClientComp}
                occupancyAvgComp={occupancyAvgComp}
                avgPerClassComp={avgPerClassComp}
              />
              <EvolucionInscritos data={activeCustomersData} />
              <HorarioReporting
                data={{
                  main: mainEvents,
                  periodLabel,
                  periodFrom: mainFrom,
                  periodTo: mainTo,
                  businessEvents,
                }}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PrimeraCompra summary={firstPurchaseSummary} />
                <ClientesPaymentsBreakdown
                  succeeded={totalRev}
                  refunded={breakdown.refunded}
                  disputed={breakdown.disputed}
                  failed={breakdown.failed}
                  refundedIds={breakdown.refundedIds}
                  disputedIds={breakdown.disputedIds}
                  failedIds={breakdown.failedIds}
                  customers={customers}
                  periodLabel={periodLabel}
                  excludeSegments={["disputed", "failed"]}
                  compBreakdown={{
                    succeeded: revComp,
                    refunded: breakdownComp.refunded,
                    disputed: breakdownComp.disputed,
                    failed: breakdownComp.failed,
                  }}
                />
              </div>
              <ConversionPack summary={conversionSummary} />
              <RetencionCohorte cohorts={retentionCohorts} />
            </div>
          </section>
        }
      />
    </>
  );
}
