import { createServerClient } from "./supabase";

export type PaymentErrorAck = { customerId: string; errorDate: string | null; ackedAt: string };

export async function loadPaymentErrorAcks(): Promise<Map<string, PaymentErrorAck>> {
  const db = createServerClient();
  const { data, error } = await db.from("payment_error_acks").select("*");
  if (error) {
    console.error("loadPaymentErrorAcks error:", error.message);
    return new Map();
  }
  return new Map(
    (data ?? []).map((row) => [
      row.customer_id,
      { customerId: row.customer_id, errorDate: row.error_date, ackedAt: row.acked_at },
    ]),
  );
}

/** Un ack sigue vigente si no ha aparecido un fallo más reciente desde que se reconoció. */
export function isPaymentErrorAcked(
  ack: PaymentErrorAck | undefined,
  currentErrorDate: string | null,
): boolean {
  if (!ack) return false;
  if (ack.errorDate === null || currentErrorDate === null) return true;
  return currentErrorDate <= ack.errorDate;
}

export async function ackPaymentError(customerId: string, errorDate: string | null): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("payment_error_acks")
    .upsert({ customer_id: customerId, error_date: errorDate, acked_at: new Date().toISOString() });
  if (error) throw new Error(`ackPaymentError: ${error.message}`);
}

export async function unackPaymentError(customerId: string): Promise<void> {
  const db = createServerClient();
  const { error } = await db.from("payment_error_acks").delete().eq("customer_id", customerId);
  if (error) throw new Error(`unackPaymentError: ${error.message}`);
}
