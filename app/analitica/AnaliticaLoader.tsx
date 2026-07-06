import { fmt } from "@/lib/analytics";
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
import { estimatedMRR, recurringCustomerIds } from "@/lib/stripeRecurrence";

import { loadTransactionsCached, expensesByCategoryAll, getLatestImportDate, type EconomicGroup } from "@/lib/transactions";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import { loadCategoriesCached, type Category } from "@/lib/categories";
import { loadRecurringExpensesCached, forecastConfirmedExpenses } from "@/lib/recurringExpenses";
import DesglosGastosUnificado from "./instances/DesglosGastosUnificado";
import CockpitFinanciero from "./instances/CockpitFinanciero";
import IngresosPorFuente from "./instances/IngresosPorFuente";
import type { IngresosPorFuenteRow } from "./instances/IngresosPorFuenteBody";
import EvolucionInscritos from "./instances/EvolucionInscritos";
import Financiacion from "./instances/Financiacion";
import { loadBudgetsCached, computeSpent } from "@/lib/budgets";
import Breakeven from "./instances/Breakeven";
import { computeBreakeven } from "@/lib/breakeven";
import ConversionPack from "./instances/ConversionPack";
import { subscriptionTiersFromMemberships, computeMrrByTier } from "@/lib/mrr";
import { getMemberships, getProducts, getCustomers } from "@/lib/momence";
import { catalogFromMomence, revenueByProductByMonth } from "@/lib/productRevenue";
import { computeSubscriptionCohorts, computeRetentionCohorts } from "@/lib/subscriptionCohort";
import EvolucionSuscripcionesFullWidth from "./instances/EvolucionSuscripcionesFullWidth";
import RetencionCohorte from "./instances/RetencionCohorte";
import { loadBusinessEvents } from "@/lib/businessEvents";
import { getMomenceChurn } from "@/lib/subscriberSnapshots";
import { loadPaymentErrorAcks, isPaymentErrorAcked } from "@/lib/paymentErrorAcks";
import { ChartCard } from "@/components/charts";
import { pad2 } from "@/lib/periodCalculation";
import AnaliticaKPIs from "./AnaliticaKPIs";
import ClientesPaymentsBreakdown from "@/app/clientes/ClientesPaymentsBreakdown";
import PrevisionGastos from "./PrevisionGastos";
import OcupacionTab from "./instances/OcupacionTab";
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

export default async function AnaliticaLoader({
  mainFrom, mainTo, compFrom, compTo, periodLabel, compDateRange,
}: Props) {
  const now = new Date();
  const curMonth  = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  const [
    paymentsAll, membershipsAll, productsAll, customersAll,
    txnsAll, dbCategories, budgets, businessEvents, recurringExpenses, breakdown,
    bancoLastImport, momenceChurn, paymentErrorAcks,
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
    getLatestImportDate(),
    getMomenceChurn(),
    loadPaymentErrorAcks(),
  ]);

  // Stripe/Momence se leen en vivo en cada carga; el banco depende de la última subida manual de CSV.
  const liveLastUpdated = formatRelativeTime(now.toISOString());
  const bancoLastUpdated = formatRelativeTime(bancoLastImport);

  // Mapa stripeId → cliente fusionado por email, para agrupar cohortes/clientes por persona real
  const stripeCustomersAll = await loadStripeCustomers(paymentsAll, curMonth);
  const primaryIdMap = buildPrimaryIdMap(stripeCustomersAll);

  const pMain = paymentsAll.filter((p) => p.date >= mainFrom && p.date <= mainTo);
  const pComp = paymentsAll.filter((p) => p.date >= compFrom && p.date <= compTo);
  const txnsMain = txnsAll.filter((t) => t.date >= mainFrom && t.date <= mainTo);

  const hasSales  = paymentsAll.length > 0;
  const totalRev  = stripeTotalRevenue(pMain);
  const stripeFees = stripeTotalFees(pMain);
  const stripeNet  = stripeTotalNet(pMain);

  const ticketMedio = pMain.length > 0 ? totalRev / pMain.length : 0;

  // ── Recurrencia (derivada de pagos, no de suscripciones Stripe) ──
  const recurringIds    = recurringCustomerIds(paymentsAll, curMonth);
  const realMrr         = estimatedMRR(paymentsAll, curMonth);

  // Recurrentes activas: ≥2 pagos en últimos 3 meses Y pagaron en los últimos 30 días
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
  const activeRecurringCount = new Set(
    paymentsAll
      .filter((p) => p.customerId && recurringIds.has(p.customerId) && p.date >= thirtyDaysAgoStr)
      .map((p) => p.customerId!)
  ).size;

  const salesAll = toSales(paymentsAll);

  // Momence CSV: export manual, ya no se actualiza en tiempo real. Solo se usa para
  // Urban Sports Club (paga por transferencia bancaria, sin fuente en vivo) y para
  // breakeven histórico. Conversión del pack y "de dónde vienen los suscriptores" usan
  // salesAll (Stripe + producto inferido por importe, igual que en Clientes) — en vivo.
  const momenceSalesAll = loadSales();

  // ── Urban Sports Club: ingresos desde Momence CSV (USC paga por transferencia, no Stripe) ──
  const uscSales   = momenceSalesAll.filter((s) => s.method === "urban-sports-club" && s.paymentDate >= mainFrom && s.paymentDate <= mainTo);
  const uscRevenue = uscSales.reduce((sum, s) => sum + s.amount, 0);
  const uscCount   = uscSales.length;
  const revComp    = stripeTotalRevenue(pComp);
  const uscRevComp = momenceSalesAll.filter((s) =>
    s.method === "urban-sports-club" &&
    s.paymentDate >= compFrom &&
    s.paymentDate <= compTo
  ).reduce((sum, s) => sum + s.amount, 0);
  const q1Revenue = totalRev + uscRevenue;
  const q1RevComp = revComp + uscRevComp;

  // Última fecha con datos reales de Urban (el CSV no se actualiza solo) — se usa para
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
  const totalExpCat   = expByCategory.reduce((s, r) => s + r.total, 0);

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
  const mrrByTier = computeMrrByTier(customersAll, subscriptionTiers);

  // ── Evolución de ingresos + altas/bajas/reactivaciones (histórico completo) ──
  const paymentsAllBounded = uscLastDate ? paymentsAll.filter((p) => p.date <= uscLastDate) : paymentsAll;
  const monthlyStripeRevenue = revenueByProductByMonth(paymentsAllBounded, productCatalog);
  const uscByMonth = new Map<string, number>();
  for (const s of momenceSalesAll) {
    if (s.method !== "urban-sports-club") continue;
    const m = s.paymentDate.slice(0, 7);
    uscByMonth.set(m, (uscByMonth.get(m) ?? 0) + s.amount);
  }

  // Ingresos por fuente: bruto, comisión y neto de Stripe por mes + USC neto
  const monthlyStripeGrossMap = new Map<string, number>();
  const monthlyStripeFeesMap  = new Map<string, number>();
  const monthlyStripeNetMap   = new Map<string, number>();
  for (const p of paymentsAllBounded) {
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

  const subscriptionCohorts = computeSubscriptionCohorts(paymentsAllBounded, subscriptionTiers, primaryIdMap);
  const retentionCohorts = computeRetentionCohorts(paymentsAllBounded, subscriptionTiers, 4, primaryIdMap);

  const transactionsByCategory: Record<string, { date: string; amount: number; concept: string; contact: string }[]> = {};
  for (const t of txnsMain) {
    if (!t.category) continue;
    if (!transactionsByCategory[t.category]) transactionsByCategory[t.category] = [];
    transactionsByCategory[t.category].push({ date: t.date, amount: t.amount, concept: t.concept ?? "", contact: t.contact ?? "" });
  }

  // ── Desglose de gastos: visión general (Personal/OpEx/CapEx) vs. específico (Personal+OpEx) ──
  const expGroupTotals = groupExpensesByEconomicGroup(expByCategory, transactionsByCategory);
  const expByTopCategory = groupExpensesByTopCategory(expByCategory, dbCatByValue, dbCatById, EXPENSE_COLORS);
  const totalExpCatNoCapex = expGroupTotals.filter((g) => g.group !== "capex").reduce((s, g) => s + g.total, 0);

  // ── Salud financiera (datos completos) ──
  const today_ym = curMonth;

  const currentBalance = [...txnsAll].sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null)?.balance ?? null;
  const balanceDate = [...txnsAll].sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null)?.date ?? null;

  const burnByMonth = new Map<string, number>();
  const suministrosByMonth = new Map<string, number>();
  const SUMINISTROS_CATS = new Set(["Electricidad", "Agua"]);
  for (const t of txnsAll) {
    if (t.amount >= 0 || !t.category) continue;
    if (BURN_CATS.has(t.category)) {
      const m = t.date.slice(0, 7);
      burnByMonth.set(m, (burnByMonth.get(m) ?? 0) + Math.abs(t.amount));
    }
    if (SUMINISTROS_CATS.has(t.category)) {
      const m = t.date.slice(0, 7);
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
  const fiscalRows = [...fiscalByQuarter.entries()]
    .map(([quarter, v]) => ({ quarter, ...v }))
    .sort((a, b) => b.quarter.localeCompare(a.quarter))
    .slice(0, 6);

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

  // ── Clientela (composición, altas, riesgo de baja) ───────────────────────
  const recurringForecasts = forecastConfirmedExpenses(recurringExpenses, txnsAll, undefined, dbCategories);
  const gastosComprometidos = recurringForecasts.reduce((s, f) => s + Math.abs(f.amount), 0) + avgSuministros;

  const activeMomenceSubCount = mrrByTier.reduce((s, t) => s + t.activeCount, 0);

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
  const compPayerIds = new Set(pComp.filter((p) => p.customerId).map((p) => p.customerId!));

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
  const payingCustomers     = customers.filter((c) => c.stripeIds.some((sid) => mainPayerIds.has(sid)));
  const payingCustomersComp = customers.filter((c) => c.stripeIds.some((sid) => compPayerIds.has(sid)));
  const newCustomers         = payingCustomers.filter((c) => c.isNew);
  const reactivatedCustomers = payingCustomers.filter((c) => !c.isNew && !c.isRecurring);

  const activeCount     = payingCustomers.length;
  const activeCountComp = payingCustomersComp.length;
  const spendPerClient     = activeCount     > 0 ? totalRev     / activeCount     : 0;
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
        <div className="bg-warning/10 border border-warning/30 rounded p-4 text-sm text-warning mb-6">
          Sin datos de ventas. Copia el CSV de Momence a{" "}
          <code className="font-mono bg-warning/10 px-1 rounded text-xs">data/sales.csv</code>.
        </div>
      )}

      <AnaliticaTabs
        caja={
          <section>
            <SectionHeader id="caja" title="Caja y resultado" />
            <div className="space-y-4">
              <CockpitFinanciero
                curMonthLabel={monthLabel(curMonth)}
                currentBalance={currentBalance}
                balanceDate={balanceDate}
                runwayMonths={runwayMonths}
                avgMonthlyBurn={avgMonthlyBurn}
                completeBurnMonthsCount={completeBurnMonths.length}
                ventasPrevistas={avgMonthlyRevenue}
                gastosComprometidos={gastosComprometidos}
                sales={salesAll}
                txns={txnsAll}
                lastUpdated={liveLastUpdated}
                nextIvaLabel={nextIvaObligation?.date ?? null}
                nextIvaQuarter={nextIvaObligation?.quarter ?? null}
                ivaNeto={nextIvaQuarterData?.ivaNeto ?? 0}
                ivaSoportado={nextIvaQuarterData?.ivaSoportado ?? 0}
                ivaRepercutido={nextIvaQuarterData?.ivaRepercutido ?? 0}
                retenciones={nextIvaQuarterData?.retenciones ?? 0}
                ivaQuarterClosed={nextIvaQuarterClosed}
              />
              <Breakeven points={breakevenPoints} />
            </div>
          </section>
        }
        gastos={
          <section>
            <SectionHeader id="gastos" title="Gastos" />
            <div className="space-y-4">
              <DesglosGastosUnificado
                groups={expGroupTotals}
                categories={expByTopCategory}
                transactionsByCategory={transactionsByCategory}
                totalExpCat={totalExpCat}
                totalExpCatNoCapex={totalExpCatNoCapex}
                rangeLabel={periodLabel}
              />
              <PrevisionGastos forecasts={recurringForecasts} categories={dbCategories} avgSuministros={avgSuministros} />
            </div>
          </section>
        }
        ingresos={
          <section>
            <SectionHeader id="ingresos" title="Ingresos" />
            <div className="space-y-4">
              <IngresosPorFuente
                stripeGross={totalRev}
                stripeFees={stripeFees}
                stripeNet={stripeNet}
                uscGross={uscRevenue}
                monthly={monthlyByFuente}
                dateRange={periodLabel}
                lastUpdated={liveLastUpdated}
              />
              <EvolucionSuscripcionesFullWidth monthly={monthlyStripeRevenue} cohorts={subscriptionCohorts} events={businessEvents} rawPayments={pMain} />
            </div>
          </section>
        }
        clientes={
          <section>
            <SectionHeader id="clientes" title="Clientes" />
            <div className="space-y-4">
              <AnaliticaKPIs
                customers={customers}
                periodLabel={periodLabel}
                periodFrom={mainFrom}
                periodTo={mainTo}
                compDateRange={compDateRange}
                spendPerClient={spendPerClient}
                spendPerClientComp={spendPerClientComp}
                newCustomers={newCustomers}
                reactivatedCustomers={reactivatedCustomers}
                convertCandidates={convertCandidates}
                activeMomenceSubCount={activeMomenceSubCount}
                activeRecurringCount={activeRecurringCount}
                momenceChurn={momenceChurn}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                />
                <PrimeraCompra summary={firstPurchaseSummary} />
              </div>
              <EvolucionInscritos data={activeCustomersData} />
              <RetencionCohorte cohorts={retentionCohorts} />
              <ConversionPack summary={conversionSummary} />
            </div>
          </section>
        }
        fiscal={
          <section>
            <SectionHeader id="fiscal" title="Fiscal y financiación" />
            <div className="space-y-4">
              <ChartCard title="Próximas obligaciones">
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
              </ChartCard>
              <ChartCard
                title="IVA soportado y retenciones"
                subtitle="Según el IVA/retención asignado por contacto al importar (Configuración → Contactos)"
                sources={["excel"]}
                lastUpdated={bancoLastUpdated}
              >
                {fiscalRows.length === 0 ? (
                  <p className="text-sm text-navy/40">Todavía no hay movimientos con IVA o retención asignados.</p>
                ) : (
                  <div className="space-y-3">
                    {fiscalRows.map((r) => (
                      <div key={r.quarter} className="flex items-center justify-between">
                        <span className="text-sm text-navy">{r.quarter}</span>
                        <div className="flex items-center gap-4 text-xs text-navy/55">
                          <span>IVA soportado <strong className="text-navy tabular-nums">{fmt(r.iva)}</strong></span>
                          <span>Retenciones <strong className="text-navy tabular-nums">{fmt(r.retencion)}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ChartCard>
              <Financiacion initialBudgets={budgets} spent={budgetSpent} />
            </div>
          </section>
        }
        ocupacion={
          <section>
            <SectionHeader id="ocupacion" title="Ocupación" />
            <OcupacionTab
              mainFrom={mainFrom}
              mainTo={mainTo}
              compFrom={compFrom}
              compTo={compTo}
              periodLabel={periodLabel}
              businessEvents={businessEvents}
            />
          </section>
        }
      />
    </>
  );
}
