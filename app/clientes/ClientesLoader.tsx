import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { estimatedMRR } from "@/lib/stripeRecurrence";
import { loadBusinessEvents } from "@/lib/businessEvents";
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
  const [customers, businessEvents] = await Promise.all([
    loadStripeCustomers(payments, curMonth),
    loadBusinessEvents(),
  ]);

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

  const lastSubById  = new Map<string, { date: string; product: string }>();
  const lastPackById = new Map<string, { date: string; product: string }>();

  for (const p of payments) {
    if (!p.customerId) continue;
    if (p.inferredType === "subscription") {
      const ex = lastSubById.get(p.customerId);
      if (!ex || p.date > ex.date) lastSubById.set(p.customerId, { date: p.date, product: p.inferredProduct });
    } else if (p.inferredType === "pack") {
      const ex = lastPackById.get(p.customerId);
      if (!ex || p.date > ex.date) lastPackById.set(p.customerId, { date: p.date, product: p.inferredProduct });
    }
  }

  const today = new Date();
  function daysSince(dateStr: string): number {
    return Math.floor((today.getTime() - new Date(dateStr + "T12:00:00").getTime()) / 86_400_000);
  }

  const customersWithChurn = customers.map((c) => {
    let lastSub:  { date: string; product: string } | null = null;
    let lastPack: { date: string; product: string } | null = null;
    for (const sid of c.stripeIds) {
      const sub  = lastSubById.get(sid);
      if (sub  && (!lastSub  || sub.date  > lastSub.date))  lastSub  = sub;
      const pack = lastPackById.get(sid);
      if (pack && (!lastPack || pack.date > lastPack.date)) lastPack = pack;
    }
    return {
      ...c,
      daysSinceLastSub:  lastSub  ? daysSince(lastSub.date)  : null,
      daysSinceLastPack: lastPack ? daysSince(lastPack.date) : null,
      lastPackProduct:   lastPack?.product ?? null,
      lastSubProduct:    lastSub?.product  ?? null,
      isActive: c.stripeIds.some((sid) => mainActiveSet.has(sid)),
      isNew:    c.stripeIds.some((sid) => mainNewSet.has(sid)),
    };
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
      <ClientesShell customers={customersWithChurn} payments={payments} events={businessEvents} />
    </>
  );
}
