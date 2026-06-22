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

  const mainNewSet = new Set<string>();
  let newCountMain = 0, newCountComp = 0;
  for (const [cid, firstDate] of firstPaymentMap) {
    if (firstDate >= mainFrom && firstDate <= mainTo) { mainNewSet.add(cid); newCountMain++; }
    else if (firstDate >= compFrom && firstDate <= compTo) { newCountComp++; }
  }

  const customersWithChurn = enrichCustomers(customers, payments, {
    activeIds: mainActiveSet,
    newIds: mainNewSet,
  });

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
