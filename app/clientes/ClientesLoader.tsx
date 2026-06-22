import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { estimatedMRR } from "@/lib/stripeRecurrence";
import { enrichCustomers } from "@/lib/customerEnrichment";
import ClientesShell from "./ClientesShell";
import ClientesKPIs from "./ClientesKPIs";

type Props = {
  mainFrom: string;
  mainTo: string;
  compFrom: string;
  compTo: string;
  periodLabel: string;
  compDateRange: string;
  curMonth: string;
  prevMonth: string;
};

export default async function ClientesLoader({
  mainFrom, mainTo, compFrom, compTo,
  periodLabel, compDateRange, curMonth, prevMonth,
}: Props) {
  const payments = await loadStripePaymentsCached();
  const customers = await loadStripeCustomers(payments, curMonth);

  const mrr = estimatedMRR(payments, curMonth);

  const pMain = payments.filter((p) => p.date >= mainFrom && p.date <= mainTo);
  const pComp = payments.filter((p) => p.date >= compFrom && p.date <= compTo);

  const grossRevenue     = pMain.reduce((s, p) => s + p.amount, 0);
  const grossRevenueComp = pComp.reduce((s, p) => s + p.amount, 0);

  const mainActiveSet = new Set(pMain.filter((p) => p.customerId).map((p) => p.customerId!));
  const compActiveSet = new Set(pComp.filter((p) => p.customerId).map((p) => p.customerId!));

  const firstPaymentMap = new Map<string, string>();
  for (const p of payments) {
    if (!p.customerId) continue;
    const ex = firstPaymentMap.get(p.customerId);
    if (!ex || p.date < ex) firstPaymentMap.set(p.customerId, p.date);
  }

  // Solo cuenta como "nuevo" si tiene un único perfil de Stripe bajo su email
  function isNewInRange(c: { id: string; stripeIds: string[] }, from: string, to: string): boolean {
    if (c.stripeIds.length !== 1) return false;
    const firstDate = firstPaymentMap.get(c.stripeIds[0]);
    return !!firstDate && firstDate >= from && firstDate <= to;
  }
  const mainNewCustomerIds = new Set(customers.filter((c) => isNewInRange(c, mainFrom, mainTo)).map((c) => c.id));

  const customersWithChurn = enrichCustomers(customers, payments, {
    activeIds: mainActiveSet,
    newCustomerIds: mainNewCustomerIds,
  });

  // Conteo deduplicado por cliente fusionado (no por ID de Stripe en bruto), igual que en Analítica
  const newCountMain = customersWithChurn.filter((c) => c.isNew).length;
  const newCountComp = customers.filter((c) => isNewInRange(c, compFrom, compTo)).length;

  return (
    <>
      <ClientesKPIs
        customers={customersWithChurn}
        mrr={mrr}
        prevMonthLabel={prevMonth.slice(5)}
        curMonthLabel={curMonth.slice(5)}
        periodLabel={periodLabel}
        periodFrom={mainFrom}
        periodTo={mainTo}
        compDateRange={compDateRange}
        grossRevenue={grossRevenue}
        grossRevenueComp={grossRevenueComp}
        newCount={newCountMain}
        newCountComp={newCountComp}
        activeCount={mainActiveSet.size}
        activeCountComp={compActiveSet.size}
      />
      <ClientesShell customers={customersWithChurn} payments={payments} />
    </>
  );
}
