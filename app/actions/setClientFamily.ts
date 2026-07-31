"use server";
import { setClientFamily, setFamilyMember } from "@/lib/clientFamily";

export async function setClientFamilyAction(customerId: string, isFamily: boolean) {
  await setClientFamily(customerId, isFamily);
}

/** Familiar por member_id de Momence (funciona también para clientes sin perfil de Stripe). */
export async function setFamilyMemberAction(memberId: number, isFamily: boolean) {
  await setFamilyMember(memberId, isFamily);
}
