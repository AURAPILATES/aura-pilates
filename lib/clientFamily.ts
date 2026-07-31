import { createServerClient } from "./supabase";

/** IDs (customer_id fusionado por email) de los clientes marcados como "Familiar". */
export async function loadFamilyClientIds(): Promise<Set<string>> {
  const db = createServerClient();
  const { data, error } = await db
    .from("client_family")
    .select("customer_id")
    .eq("is_family", true);
  if (error) {
    console.error("loadFamilyClientIds error:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((row) => row.customer_id));
}

/** Marca o desmarca un cliente como "Familiar" (clave: customer_id de Stripe, flujo antiguo). */
export async function setClientFamily(customerId: string, isFamily: boolean): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("client_family")
    .upsert({ customer_id: customerId, is_family: isFamily, updated_at: new Date().toISOString() });
  if (error) throw new Error(`setClientFamily: ${error.message}`);
}

// ── Familiar por member_id de Momence (flujo nuevo: funciona también para solo-Momence) ──

/** member_id de los clientes marcados como "Familiar" (tabla client_family_v2). */
export async function loadFamilyMemberIds(): Promise<Set<number>> {
  const db = createServerClient();
  const { data, error } = await db.from("client_family_v2").select("member_id").eq("is_family", true);
  if (error) {
    console.error("loadFamilyMemberIds error:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((row) => Number(row.member_id)));
}

/** Marca o desmarca un miembro de Momence como "Familiar". */
export async function setFamilyMember(memberId: number, isFamily: boolean): Promise<void> {
  const db = createServerClient();
  const { error } = await db
    .from("client_family_v2")
    .upsert({ member_id: memberId, is_family: isFamily, updated_at: new Date().toISOString() });
  if (error) throw new Error(`setFamilyMember: ${error.message}`);
}
