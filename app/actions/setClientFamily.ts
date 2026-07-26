"use server";
import { setClientFamily } from "@/lib/clientFamily";

export async function setClientFamilyAction(customerId: string, isFamily: boolean) {
  await setClientFamily(customerId, isFamily);
}
