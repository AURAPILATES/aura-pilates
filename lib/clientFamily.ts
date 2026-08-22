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
// Clientes/Analítica, se relabela como "Familiar" si el pago pertenece a un cliente ya marcado
// como tal. Se identifica por customerId/stripeIds (no por el email del cargo puntual, que puede
// no coincidir con el email fusionado del cliente si no guardó tarjeta) - mismo criterio en
// todos los sitios donde se hace este cruce, para que los totales cuadren entre pestañas.

/** Emails (en minúsculas) de miembros de Momence marcados como Familiar (client_family_v2), a
 * partir del roster completo de Momence - para unir con el flujo de Stripe (client_family) por
 * email, ver familyStripeIdSet. "Familiar" se puede marcar desde la ficha de Stripe o la de
 * Momence indistintamente y ambas deben verse igual en todas partes. */
export function familyMemberEmails(
  members: Array<{ id: number; email: string | null }>,
  familyMemberIds: Set<number>,
): Set<string> {
  const set = new Set<string>();
  for (const m of members) if (familyMemberIds.has(m.id) && m.email) set.add(m.email.toLowerCase());
  return set;
}

/** IDs de Stripe (todos los fusionados) de los clientes Familiar: propios (`isFamily`, flujo
 * Stripe) unidos con los del flujo Momence por email (`familyMemberEmailsSet`, ver
 * familyMemberEmails) - omitir ese segundo argumento si `isFamily` ya viene unido de antemano. */
export function familyStripeIdSet(
  customers: Array<{ email: string | null; stripeIds: string[]; isFamily?: boolean }>,
  familyMemberEmailsSet: Set<string> = new Set(),
): Set<string> {
  const set = new Set<string>();
  for (const c of customers) {
    const isFamily = !!c.isFamily || (!!c.email && familyMemberEmailsSet.has(c.email.toLowerCase()));
    if (isFamily) for (const id of c.stripeIds) set.add(id);
  }
  return set;
}

/** Etiqueta a usar para un pago que no casó con ningún producto conocido. */
export function otroOrFamiliar(customerId: string | null, familyStripeIds: Set<string>): "Familiar" | "Otro" {
  return customerId && familyStripeIds.has(customerId) ? "Familiar" : "Otro";
}
