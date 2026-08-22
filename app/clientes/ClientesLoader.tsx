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
  // loadStripeCustomers depende de payments; los otros 4 no dependen de nada de aquí - se piden
  // todos a la vez (en vez de esperar a payments primero) y loadStripeCustomers se lanza en cuanto
  // payments resuelve.
  const [payments, familyIds, familyMemberIds, paymentErrorAcks, urbanRates] = await Promise.all([
    loadStripePaymentsCached(),
    loadFamilyClientIds(),
    loadFamilyMemberIds(),
    loadPaymentErrorAcks(),
    loadUrbanRates(),
  ]);
  const customers = await loadStripeCustomers(payments, curMonth);

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
