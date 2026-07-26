import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { enrichCustomers } from "@/lib/customerEnrichment";
import { loadFamilyClientIds } from "@/lib/clientFamily";
import ClientesShell from "./ClientesShell";

type Props = {
  curMonth: string;
};

export default async function ClientesLoader({ curMonth }: Props) {
  const payments = await loadStripePaymentsCached();
  const [customers, familyIds] = await Promise.all([
    loadStripeCustomers(payments, curMonth),
    loadFamilyClientIds(),
  ]);

  const customersWithChurn = enrichCustomers(customers, payments, { familyIds });

  return <ClientesShell customers={customersWithChurn} payments={payments} />;
}
