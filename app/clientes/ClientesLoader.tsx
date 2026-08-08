import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { enrichCustomers } from "@/lib/customerEnrichment";
import { loadFamilyClientIds, loadFamilyMemberIds } from "@/lib/clientFamily";
import { loadPaymentErrorAcks } from "@/lib/paymentErrorAcks";
import { getMemberClientsV2 } from "@/lib/memberClientsV2";
import { getUrbanClientsMatrix } from "@/lib/clientActivityV2";
import { loadUrbanRates } from "@/lib/urbanRates";
import ClientesShell from "./ClientesShell";

type Props = {
  curMonth: string;
};

export default async function ClientesLoader({ curMonth }: Props) {
  const payments = await loadStripePaymentsCached();
  const [customers, familyIds, familyMemberIds, paymentErrorAcks, urbanRates] = await Promise.all([
    loadStripeCustomers(payments, curMonth),
    loadFamilyClientIds(),
    loadFamilyMemberIds(),
    loadPaymentErrorAcks(),
    loadUrbanRates(),
  ]);

  // "Hablado con cliente" es una anotación (paymentErrorAcked), no oculta el error: el error de
  // pago real sigue contando y mostrándose hasta que Stripe cobre con éxito. Mismo criterio que
  // AnaliticaLoader, para que Clientes y Analítica coincidan.
  const customersWithChurn = enrichCustomers(customers, payments, { familyIds, paymentErrorAcks });

  const [memberClients, urbanClients] = await Promise.all([
    getMemberClientsV2(customersWithChurn, familyMemberIds).catch(() => []),
    getUrbanClientsMatrix(urbanRates).catch(() => []),
  ]);

  return (
    <ClientesShell
      customers={customersWithChurn}
      payments={payments}
      clients={memberClients}
      urbanClients={urbanClients}
    />
  );
}
