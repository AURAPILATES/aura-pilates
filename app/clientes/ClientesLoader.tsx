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
  mainFrom, mainTo, compFrom, compTo, compDateRange, curMonth,
}: Props) {
  const payments = await loadStripePaymentsCached();
  const customers = await loadStripeCustomers(payments, curMonth);

  const mrr = estimatedMRR(payments, curMonth);

  const pMain = payments.filter((p) => p.date >= mainFrom && p.date <= mainTo);
  const pComp = payments.filter((p) => p.date >= compFrom && p.date <= compTo);

  const grossRevenue     = pMain.reduce((s, p) => s + p.amount, 0);
  const grossRevenueComp = pComp.reduce((s, p) => s + p.amount, 0);

  const customersWithChurn = enrichCustomers(customers, payments);

  return (
    <>
      <ClientesKPIs
        mrr={mrr}
        periodFrom={mainFrom}
        periodTo={mainTo}
        compDateRange={compDateRange}
        grossRevenue={grossRevenue}
        grossRevenueComp={grossRevenueComp}
      />
      <ClientesShell customers={customersWithChurn} payments={payments} />
    </>
  );
}
