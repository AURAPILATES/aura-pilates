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

// ── Cruce "Otro" × Familiar ─────────────────────────────────────────────────
//
// Un pago cae en "Otro" cuando su importe no casa con ningún precio conocido (p.ej. un
// descuento puntual a un alumno Familiar). Para no perder esos alumnos en el cubo "Otro" de
// Clientes/Analítica, se relabela como "Familiar" si el email del pago coincide con el de un
// cliente ya marcado como tal - el email es la clave porque un alumno Familiar puede tener un
// customer_id de Stripe distinto al que tiene marcado el flag (p.ej. pago sin tarjeta guardada).

/** Emails (en minúsculas) de los clientes marcados como Familiar. */
export function familyEmailSet(customers: Array<{ email: string | null; isFamily?: boolean }>): Set<string> {
  const set = new Set<string>();
  for (const c of customers) if (c.isFamily && c.email) set.add(c.email.toLowerCase());
  return set;
}

/** Etiqueta a usar para un pago que no casó con ningún producto conocido. */
export function otroOrFamiliar(customerEmail: string | null, familyEmails: Set<string>): "Familiar" | "Otro" {
  return customerEmail && familyEmails.has(customerEmail.toLowerCase()) ? "Familiar" : "Otro";
}
