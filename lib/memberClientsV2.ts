import { createServerClient } from "./supabase";
import { getMembersV2 } from "./momenceV2";
import type { EnrichedCustomer } from "./customerEnrichment";
import type { StripeDiscount } from "./stripeCustomers";

// Modelo unificado de cliente centrado en el CENSO REAL de Momence (todos los miembros), con:
//  - Plan y estado REALES desde subscriber_snapshots_v2 (suscripción/pack activo, congelado,
//    créditos, caducidad) — ya no inferidos de la antigüedad de los pagos de Stripe.
//  - Actividad real desde class_bookings_v2 (clases asistidas, última/primera clase).
//  - Dinero desde Stripe (total, pagos, errores de cobro), cruzado por email.
// Sustituye los "malabares" de la pestaña Estado. Ver [[project-profesoras-v2]].

export type PlanKind = "subscription" | "pack" | "urban";

export type MemberPlan = {
  name: string;
  kind: PlanKind;
  isFrozen: boolean;
  creditsLeft: number | null;
  creditsTotal: number | null;
  endDate: string | null; // ISO
};

export type StatusTone = "success" | "warning" | "danger" | "muted";
export type StatusKey =
  | "activa" | "congelada" | "pack" | "pack_bajo" | "pack_agotado"
  | "urban" | "sin_plan" | "inactivo" | "error_pago";

export type MemberStatus = { key: StatusKey; label: string; tone: StatusTone; detail?: string };

export type MemberStripe = {
  primaryId: string;   // id primario del cliente fusionado (clave de las acciones Familiar/ack)
  stripeIds: string[];
  totalSpent: number;
  paymentCount: number;
  lastPaymentDate: string | null;
  firstPaymentDate: string | null;
  hasPaymentError: boolean;
  paymentErrorDate: string | null;
  paymentErrorAmount: number | null;
  paymentErrorReason: string | null;
  discount: StripeDiscount | null;
  paymentErrorAcked: boolean;
};

export type MemberClient = {
  id: string;             // clave de fila: "m<memberId>" o "s<stripeId>" (solo-Stripe)
  memberId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  plan: MemberPlan | null;
  activeSubCount: number;  // suscripciones activas no congeladas (>1 = posible duplicado/doble cobro)
  attended: number;
  firstClassDate: string | null;
  firstTeacher: string | null;
  lastClassDate: string | null;
  stripe: MemberStripe | null;
  isFamily: boolean;
  status: MemberStatus;
};

type SnapRow = {
  member_id: number;
  membership_name: string | null;
  type: string;
  is_frozen: boolean;
  end_date: string | null;
  event_credits_left: number | null;
  event_credits_total: number | null;
};

type BookingRow = { member_id: number; teacher_name: string; session_starts_at: string; checked_in: boolean };

async function readAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

const isSubscriptionType = (t: string) => t === "subscription" || t === "on-demand-subscription" || t === "patron";

// Los miembros de Urban Sports Club llegan con un email del dominio de Urban y no tienen
// suscripción propia en Momence (reservan vía Urban). Se les asigna un "plan" Urban sintético
// para que no queden vacíos ni caigan en "sin plan"/"inactivo".
const isUrbanEmail = (email: string | null) => !!email && email.toLowerCase().includes("urbansportsclub.com");
const URBAN_PLAN: MemberPlan = { name: "Urban", kind: "urban", isFrozen: false, creditsLeft: null, creditsTotal: null, endDate: null };

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// Estado real, combinando el plan del snapshot (verdad de "tiene plan activo ahora"), el error
// de cobro de Stripe y la actividad reciente (para distinguir "sin plan pero viene" de "inactivo").
function computeStatus(plan: MemberPlan | null, stripe: MemberStripe | null, lastActivity: string | null): MemberStatus {
  if (stripe?.hasPaymentError) {
    const d = stripe.paymentErrorDate ? daysSince(stripe.paymentErrorDate) : null;
    return { key: "error_pago", label: "Error de pago", tone: "danger", detail: d != null ? `hace ${d}d` : undefined };
  }
  if (plan) {
    if (plan.kind === "urban") return { key: "urban", label: "Urban", tone: "success" };
    if (plan.kind === "subscription") {
      return plan.isFrozen
        ? { key: "congelada", label: "Congelada", tone: "warning" }
        : { key: "activa", label: "Al día", tone: "success" };
    }
    // pack
    const left = plan.creditsLeft;
    const total = plan.creditsTotal;
    const expDays = plan.endDate ? daysUntil(plan.endDate) : null;
    if ((left != null && left <= 0) || (expDays != null && expDays < 0)) {
      return { key: "pack_agotado", label: "Pack agotado", tone: "warning" };
    }
    const detail = left != null && total != null ? `${left} de ${total} clases` : expDays != null ? `caduca en ${expDays}d` : undefined;
    if (left != null && left <= 2) return { key: "pack_bajo", label: "Pocas clases", tone: "warning", detail };
    if (expDays != null && expDays <= 14) return { key: "pack", label: "Caduca pronto", tone: "warning", detail: `caduca en ${expDays}d` };
    return { key: "pack", label: "Pack activo", tone: "success", detail };
  }
  // Sin plan activo
  if (lastActivity) {
    const d = daysSince(lastActivity);
    if (d <= 45) return { key: "sin_plan", label: "Sin plan", tone: "warning", detail: `activo/a hace ${d}d` };
    return { key: "inactivo", label: "Inactivo/a", tone: "muted", detail: `hace ${d}d` };
  }
  return { key: "inactivo", label: "Sin actividad", tone: "muted" };
}

export async function getMemberClientsV2(
  stripeCustomers: EnrichedCustomer[],
  familyMemberIds: Set<number> = new Set(),
): Promise<MemberClient[]> {
  const db = createServerClient();

  // Roster real de Momence.
  const members = await getMembersV2().catch(() => []);

  // Plan activo por miembro: último snapshot v2.
  const { data: latest } = await db.from("subscriber_snapshots_v2").select("date").order("date", { ascending: false }).limit(1);
  const snapDate = latest?.[0]?.date as string | undefined;
  const snapRows = snapDate
    ? await readAll<SnapRow>((from, to) =>
        db
          .from("subscriber_snapshots_v2")
          .select("member_id, membership_name, type, is_frozen, end_date, event_credits_left, event_credits_total")
          .eq("date", snapDate)
          .range(from, to),
      )
    : [];
  // Un miembro puede tener varias membresías activas: priorizamos suscripción; entre packs, el
  // de más créditos restantes.
  // Suscripciones activas no congeladas por miembro (mismo criterio que el panel de Momence):
  // >1 = la persona tiene varias suscripciones a la vez (posible duplicado / doble cobro).
  const subCountByMember = new Map<number, number>();
  for (const r of snapRows) {
    if (r.type === "subscription" && !r.is_frozen) subCountByMember.set(r.member_id, (subCountByMember.get(r.member_id) ?? 0) + 1);
  }

  const planByMember = new Map<number, MemberPlan>();
  for (const r of snapRows) {
    const kind: PlanKind = isSubscriptionType(r.type) ? "subscription" : "pack";
    const plan: MemberPlan = {
      name: r.membership_name ?? (kind === "subscription" ? "Suscripción" : "Pack"),
      kind,
      isFrozen: r.is_frozen,
      creditsLeft: r.event_credits_left,
      creditsTotal: r.event_credits_total,
      endDate: r.end_date,
    };
    const prev = planByMember.get(r.member_id);
    if (!prev) { planByMember.set(r.member_id, plan); continue; }
    if (prev.kind === "subscription") continue; // ya tiene suscripción, gana
    if (plan.kind === "subscription") { planByMember.set(r.member_id, plan); continue; }
    if ((plan.creditsLeft ?? 0) > (prev.creditsLeft ?? 0)) planByMember.set(r.member_id, plan);
  }

  // Asistencia por miembro.
  const bookings = await readAll<BookingRow>((from, to) =>
    db.from("class_bookings_v2").select("member_id, teacher_name, session_starts_at, checked_in").order("session_starts_at", { ascending: true }).range(from, to),
  );
  type Act = { attended: number; firstDate: string | null; firstTeacher: string | null; lastDate: string | null };
  const actByMember = new Map<number, Act>();
  for (const b of bookings) {
    if (!b.checked_in) continue;
    const a = actByMember.get(b.member_id) ?? { attended: 0, firstDate: null, firstTeacher: null, lastDate: null };
    a.attended += 1;
    const date = b.session_starts_at.slice(0, 10);
    if (!a.firstDate) { a.firstDate = date; a.firstTeacher = b.teacher_name; }
    a.lastDate = date;
    actByMember.set(b.member_id, a);
  }

  // Stripe por email.
  const stripeByEmail = new Map<string, EnrichedCustomer>();
  for (const c of stripeCustomers) if (c.email) stripeByEmail.set(c.email.toLowerCase(), c);

  const toStripe = (c: EnrichedCustomer): MemberStripe => ({
    primaryId: c.id,
    stripeIds: c.stripeIds,
    totalSpent: c.totalSpent,
    paymentCount: c.paymentCount,
    lastPaymentDate: c.lastPaymentDate,
    firstPaymentDate: c.firstPaymentDate,
    hasPaymentError: c.hasPaymentError,
    paymentErrorDate: c.paymentErrorDate,
    paymentErrorAmount: c.paymentErrorAmount,
    paymentErrorReason: c.paymentErrorReason,
    discount: c.discount,
    paymentErrorAcked: !!c.paymentErrorAcked,
  });

  const usedStripe = new Set<string>();
  const rows: MemberClient[] = [];

  for (const m of members) {
    const email = m.email ? m.email.toLowerCase() : null;
    const sc = email ? stripeByEmail.get(email) : undefined;
    if (sc) usedStripe.add(sc.id);
    // Plan real; si no tiene y es de Urban, "plan" Urban sintético.
    const plan = planByMember.get(m.id) ?? (isUrbanEmail(m.email) ? URBAN_PLAN : null);
    const act = actByMember.get(m.id);
    const stripe = sc ? toStripe(sc) : null;
    const lastActivity = [act?.lastDate ?? null, stripe?.lastPaymentDate ?? null].filter(Boolean).sort().pop() ?? null;
    rows.push({
      id: `m${m.id}`,
      memberId: m.id,
      name: `${m.firstName} ${m.lastName}`.replace(/\s+/g, " ").trim() || (m.email ?? `Miembro ${m.id}`),
      email: m.email ?? null,
      phone: m.phoneNumber ?? null,
      firstSeen: m.firstSeen ?? null,
      lastSeen: m.lastSeen ?? null,
      plan,
      activeSubCount: subCountByMember.get(m.id) ?? 0,
      attended: act?.attended ?? 0,
      firstClassDate: act?.firstDate ?? null,
      firstTeacher: act?.firstTeacher ?? null,
      lastClassDate: act?.lastDate ?? null,
      stripe,
      isFamily: familyMemberIds.has(m.id),
      status: computeStatus(plan, stripe, lastActivity),
    });
  }

  // Clientes de Stripe sin miembro de Momence (raro: pagó pero no consta como miembro): no los
  // perdemos, se añaden como filas sin actividad de clases.
  for (const c of stripeCustomers) {
    if (usedStripe.has(c.id)) continue;
    const stripe = toStripe(c);
    rows.push({
      id: `s${c.id}`,
      memberId: null,
      name: c.name ?? c.email ?? "Sin nombre",
      email: c.email,
      phone: null,
      firstSeen: null,
      lastSeen: null,
      plan: null,
      activeSubCount: 0,
      attended: 0,
      firstClassDate: null,
      firstTeacher: null,
      lastClassDate: null,
      stripe,
      isFamily: !!c.isFamily,
      status: computeStatus(null, stripe, stripe.lastPaymentDate),
    });
  }

  return rows;
}
