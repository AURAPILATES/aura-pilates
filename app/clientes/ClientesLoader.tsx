import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { enrichCustomers } from "@/lib/customerEnrichment";
import { loadFamilyClientIds } from "@/lib/clientFamily";
import { loadPaymentErrorAcks, isPaymentErrorAcked } from "@/lib/paymentErrorAcks";
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

  const enriched = enrichCustomers(customers, payments, { familyIds });

  // Un error de pago ya reconocido ("Ya hablé con ella") en Analítica deja de contar aquí
  // también, para que la lista y el recuento de "Error de pago" sean idénticos en Clientes y
  // Analítica. Mismo criterio que AnaliticaLoader.
  const customersWithChurn = enriched.map((c) =>
    c.hasPaymentError && isPaymentErrorAcked(paymentErrorAcks.get(c.id), c.paymentErrorDate)
      ? { ...c, hasPaymentError: false }
      : c,
  );

  return <ClientesShell customers={customersWithChurn} payments={payments} />;
}
