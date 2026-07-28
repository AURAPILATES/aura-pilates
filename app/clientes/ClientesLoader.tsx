import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { enrichCustomers } from "@/lib/customerEnrichment";
import { loadFamilyClientIds } from "@/lib/clientFamily";
import { loadPaymentErrorAcks } from "@/lib/paymentErrorAcks";
import ClientesShell from "./ClientesShell";

type Props = {
  curMonth: string;
};

export default async function ClientesLoader({ curMonth }: Props) {
  const payments = await loadStripePaymentsCached();
  const [customers, familyIds, paymentErrorAcks] = await Promise.all([
    loadStripeCustomers(payments, curMonth),
    loadFamilyClientIds(),
    loadPaymentErrorAcks(),
  ]);

  // "Hablado con cliente" es una anotación (paymentErrorAcked), no oculta el error: el error de
  // pago real sigue contando y mostrándose hasta que Stripe cobre con éxito. Mismo criterio que
  // AnaliticaLoader, para que Clientes y Analítica coincidan.
  const customersWithChurn = enrichCustomers(customers, payments, { familyIds, paymentErrorAcks });

  return <ClientesShell customers={customersWithChurn} payments={payments} />;
}
