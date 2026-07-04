"use server";
import { ackPaymentError } from "@/lib/paymentErrorAcks";

export async function ackPaymentErrorAction(customerId: string, errorDate: string | null) {
  await ackPaymentError(customerId, errorDate);
}
