import { loadStripePaymentsCached, loadPaymentsBreakdown, totalRevenue as stripeTotalRevenue, activeCustomersByMonth } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { enrichCustomers, hasActiveSub } from "@/lib/customerEnrichment";
import ClientesPaymentsBreakdown from "@/app/clientes/ClientesPaymentsBreakdown";
import ClientesRetentionCohort from "@/app/clientes/ClientesRetentionCohort";
import EvolucionInscritos from "@/app/finanzas/instances/EvolucionInscritos";
import AnaliticaKPIs from "./AnaliticaKPIs";
import { pad2 } from "@/lib/periodCalculation";

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
  const curMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  const [payments, breakdown] = await Promise.all([
    loadStripePaymentsCached(),
    loadPaymentsBreakdown(mainFrom, mainTo),
  ]);
  const customersRaw = await loadStripeCustomers(payments, curMonth);

  const pMain = payments.filter((p) => p.date >= mainFrom && p.date <= mainTo);
  const pComp = payments.filter((p) => p.date >= compFrom && p.date <= compTo);

  const grossRevenue     = pMain.reduce((s, p) => s + p.amount, 0);
  const grossRevenueComp = pComp.reduce((s, p) => s + p.amount, 0);

  const firstPaymentMap = new Map<string, string>();
  for (const p of payments) {
    if (!p.customerId) continue;
    const ex = firstPaymentMap.get(p.customerId);
    if (!ex || p.date < ex) firstPaymentMap.set(p.customerId, p.date);
  }
  // Solo cuenta como "nuevo" si tiene un único perfil de Stripe bajo su email
  const mainNewCustomerIds = new Set(
    customersRaw
      .filter((c) => {
        if (c.stripeIds.length !== 1) return false;
        const firstDate = firstPaymentMap.get(c.stripeIds[0]);
        return !!firstDate && firstDate >= mainFrom && firstDate <= mainTo;
      })
      .map((c) => c.id),
  );

  const mainPayerIds = new Set(pMain.filter((p) => p.customerId).map((p) => p.customerId!));
  const compPayerIds = new Set(pComp.filter((p) => p.customerId).map((p) => p.customerId!));

  const customers = enrichCustomers(customersRaw, payments, {
    activeIds: mainPayerIds,
    newCustomerIds: mainNewCustomerIds,
  });

  // ── Activos por email, deduplicados ──
  const payingCustomers     = customers.filter((c) => c.stripeIds.some((sid) => mainPayerIds.has(sid)));
  const payingCustomersComp = customers.filter((c) => c.stripeIds.some((sid) => compPayerIds.has(sid)));
  const newCustomers         = payingCustomers.filter((c) => c.isNew);
  const reactivatedCustomers = payingCustomers.filter((c) => !c.isNew && !c.isRecurring);

  const activeCount     = payingCustomers.length;
  const activeCountComp = payingCustomersComp.length;
  const spendPerClient     = activeCount     > 0 ? grossRevenue     / activeCount     : 0;
  const spendPerClientComp = activeCountComp > 0 ? grossRevenueComp / activeCountComp : 0;

  // ── Clientes por convertir a suscripción: 2+ packs (sin contar Benvinguda), sin sub activa ──
  const packCounts = new Map<string, number>();
  for (const p of payments) {
    if (p.inferredType !== "pack" || p.inferredProduct === "Pack Benvinguda" || !p.customerId) continue;
    packCounts.set(p.customerId, (packCounts.get(p.customerId) ?? 0) + 1);
  }
  function packCountForCustomer(c: { stripeIds: string[] }): number {
    return c.stripeIds.reduce((s, sid) => s + (packCounts.get(sid) ?? 0), 0);
  }
  const convertCandidates = customers.filter(
    (c) => packCountForCustomer(c) >= 2 && !hasActiveSub(c),
  );

  const activeCustomersData = activeCustomersByMonth(payments);

  return (
    <>
      <AnaliticaKPIs
        customers={customers}
        periodLabel={periodLabel}
        periodFrom={mainFrom}
        periodTo={mainTo}
        compDateRange={compDateRange}
        grossRevenue={grossRevenue}
        spendPerClient={spendPerClient}
        spendPerClientComp={spendPerClientComp}
        newCustomers={newCustomers}
        reactivatedCustomers={reactivatedCustomers}
        convertCandidates={convertCandidates}
      />
      <div className="sm:w-1/2">
        <ClientesPaymentsBreakdown
          succeeded={stripeTotalRevenue(pMain)}
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
      </div>
      <ClientesRetentionCohort payments={payments} />
      <div className="mb-8">
        <EvolucionInscritos data={activeCustomersData} />
      </div>
    </>
  );
}
