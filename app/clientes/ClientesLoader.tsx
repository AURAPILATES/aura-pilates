import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { enrichCustomers } from "@/lib/customerEnrichment";
import ClientesShell from "./ClientesShell";

type Props = {
  curMonth: string;
};

export default async function ClientesLoader({ curMonth }: Props) {
  const payments = await loadStripePaymentsCached();
  const customers = await loadStripeCustomers(payments, curMonth);

  const customersWithChurn = enrichCustomers(customers, payments);

  return <ClientesShell customers={customersWithChurn} payments={payments} />;
}
