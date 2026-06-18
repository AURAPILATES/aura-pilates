import type { MomenceCustomer, MomenceActiveSubscription } from "./momence";
import type { StripePayment } from "./stripePayments";

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

function isSubActive(sub: MomenceActiveSubscription, today: string): boolean {
  if (sub.isFreezed) return false;
  if (sub.endDate !== null && sub.endDate < today) return false;
  if (sub.type === "package-events" && sub.classesLeft !== null && sub.classesLeft <= 0) return false;
  return true;
}

/** Alumnos con al menos una suscripción o pack activos hoy */
export function countActiveStudents(customers: MomenceCustomer[], today: string): number {
  return customers.filter((c) => c.activeSubscriptions.some((s) => isSubActive(s, today))).length;
}

export type AltasMes = { nuevos: number; reactivados: number };

/**
 * Altas = pagaron en el mes pero no habían pagado en los 60 días anteriores.
 *   nuevos      = firstSeen en Momence dentro del mes (alumno nuevo)
 *   reactivados = tenían historial previo pero 60+ días sin pagar
 */
export function computeAltasMes(
  payments: StripePayment[],
  customers: MomenceCustomer[],
  month: string,
): AltasMes {
  const start  = `${month}-01`;
  const end    = monthEnd(month);
  const cutoff = addDays(start, -60);

  const firstSeenMap = new Map(customers.map((c) => [c.email.toLowerCase(), c.firstSeen]));

  const emailsThisMonth = new Set(
    payments
      .filter((p) => p.date >= start && p.date <= end && p.customerEmail)
      .map((p) => p.customerEmail!.toLowerCase()),
  );

  let nuevos      = 0;
  let reactivados = 0;

  for (const email of emailsThisMonth) {
    const firstSeen = firstSeenMap.get(email);
    if (firstSeen && firstSeen >= start) {
      nuevos++;
      continue;
    }
    const hadRecentPay = payments.some(
      (p) => p.customerEmail?.toLowerCase() === email && p.date >= cutoff && p.date < start,
    );
    if (!hadRecentPay) reactivados++;
  }

  return { nuevos, reactivados };
}

/**
 * Bajas de suscripción = ex-suscriptores (Bàsic / Plus / Pro) que no han renovado:
 *   - Al menos 2 pagos de tipo suscripción (confirma patrón recurrente, no alta única)
 *   - Último pago entre 35 y 75 días atrás (ventana de ~un mes de ciclo perdido)
 *   - Sin suscripción activa en Momence ahora mismo
 * El rango 35-75 días evita falsos positivos (cobro a día 28 cuando hoy es día 15)
 * y excluye bajas antiguas ya contabilizadas en meses anteriores.
 */
export function computeBasjasMes(
  payments: StripePayment[],
  customers: MomenceCustomer[],
  today: string,
): number {
  const activeSubEmails = new Set(
    customers
      .filter((c) => c.activeSubscriptions.some((s) => s.type === "subscription" && !s.isFreezed))
      .map((c) => c.email.toLowerCase()),
  );

  // Solo pagos de los tres planes de suscripción (Bàsic/Plus/Pro)
  const subPayments = payments.filter(
    (p) => p.customerEmail && p.inferredType === "subscription",
  );

  // Para cada email: fecha del último pago + conteo total (para confirmar recurrencia)
  const byEmail = new Map<string, { lastDate: string; count: number }>();
  for (const p of subPayments) {
    const email = p.customerEmail!.toLowerCase();
    const prev  = byEmail.get(email);
    if (!prev) {
      byEmail.set(email, { lastDate: p.date, count: 1 });
    } else {
      byEmail.set(email, {
        lastDate: p.date > prev.lastDate ? p.date : prev.lastDate,
        count: prev.count + 1,
      });
    }
  }

  let count = 0;
  for (const [email, { lastDate, count: numPayments }] of byEmail) {
    if (numPayments < 2) continue; // descarta altas únicas que no renovaron
    if (activeSubEmails.has(email)) continue;
    const days = Math.floor(
      (new Date(today).getTime() - new Date(lastDate).getTime()) / 86_400_000,
    );
    if (days >= 35 && days <= 75) count++;
  }

  return count;
}
