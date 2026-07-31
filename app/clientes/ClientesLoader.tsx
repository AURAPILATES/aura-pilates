import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { enrichCustomers } from "@/lib/customerEnrichment";
import { loadFamilyClientIds, loadFamilyMemberIds } from "@/lib/clientFamily";
import { loadPaymentErrorAcks } from "@/lib/paymentErrorAcks";
import { getClientActivityV2 } from "@/lib/clientActivityV2";
import { getMemberClientsV2 } from "@/lib/memberClientsV2";
import ClientesShell from "./ClientesShell";

type Props = {
  curMonth: string;
};

export default async function ClientesLoader({ curMonth }: Props) {
  const payments = await loadStripePaymentsCached();
  const [customers, familyIds, familyMemberIds, paymentErrorAcks] = await Promise.all([
    loadStripeCustomers(payments, curMonth),
    loadFamilyClientIds(),
    loadFamilyMemberIds(),
    loadPaymentErrorAcks(),
  ]);

  // "Hablado con cliente" es una anotación (paymentErrorAcked), no oculta el error: el error de
  // pago real sigue contando y mostrándose hasta que Stripe cobre con éxito. Mismo criterio que
  // AnaliticaLoader, para que Clientes y Analítica coincidan.
  const customersWithChurn = enrichCustomers(customers, payments, { familyIds, paymentErrorAcks });

  // Emails con algún pago en Stripe: sirven para marcar "sin pago detectado" en la vista de
  // actividad (asistencia real de Momence sin rastro de pago). Ver getClientActivityV2.
  const paidEmails = new Set(
    customersWithChurn.filter((c) => c.paymentCount > 0 && c.email).map((c) => c.email!.toLowerCase()),
  );
  const [activity, memberClients] = await Promise.all([
    getClientActivityV2(paidEmails).catch(() => null),
    getMemberClientsV2(customersWithChurn, familyMemberIds).catch(() => []),
  ]);

  return (
    <ClientesShell
      customers={customersWithChurn}
      payments={payments}
      activity={activity}
      clients={memberClients}
    />
  );
}
