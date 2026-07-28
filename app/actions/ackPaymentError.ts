"use server";
import { ackPaymentError, unackPaymentError } from "@/lib/paymentErrorAcks";

export async function ackPaymentErrorAction(customerId: string, errorDate: string | null) {
  await ackPaymentError(customerId, errorDate);
}

export async function unackPaymentErrorAction(customerId: string) {
  await unackPaymentError(customerId);
}
