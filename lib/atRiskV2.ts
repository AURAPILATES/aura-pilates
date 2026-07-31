import { createServerClient } from "./supabase";

// Umbrales (ajustables): "pocos créditos" = quedan ≤2 y ya ha usado alguno;
// "caduca pronto" = vence dentro de estos días. Se excluyen los one-off de una
// sola clase (total ≤ 1): no son target de retención.
const LOW_CREDITS = 2;
const EXPIRING_DAYS = 14;

// Señales de churn temprano por COMPORTAMIENTO (suscripciones activas × asistencia real de
// class_bookings_v2): "sin venir" = suscriptor que pagaba y venía pero no pisa clase desde hace
// ≥ INACTIVE_DAYS; "asistencia en caída" = en los últimos DROP_WINDOW días viene la mitad o
// menos que en los DROP_WINDOW anteriores (con base mínima para no saltar por ruido).
// OJO: en períodos vacacionales (agosto) estas señales se disparan más de lo normal.
const INACTIVE_DAYS = 21;
const DROP_WINDOW = 28;
const DROP_MIN_BASE = 4;

export type AtRiskReason =
  | "Congelada" | "Sin créditos" | "Pocos créditos" | "Caduca pronto"
  | "Sin venir" | "Asistencia en caída";

export type AtRiskItem = {
  memberId: number;
  email: string;
  membershipName: string;
  type: string;
  reason: AtRiskReason;
  detail: string;
  severity: number; // mayor = más urgente (orden de la lista)
};

export type AtRiskV2 = {
  date: string | null;
  items: AtRiskItem[];
  counts: Record<AtRiskReason, number>;
};

// Datos de cliente (cruzados por email con los clientes de Stripe) para el drawer
// de detalle de la lista de riesgo.
export type AtRiskCustomerInfo = {
  name: string | null;
  stripeId: string | null;
  lastPaymentDate: string | null;
  totalSpent: number;
  paymentError: boolean;
};

type Row = {
  member_id: number;
  email: string;
  membership_name: string;
  type: string;
  start_date: string | null;
  event_credits_left: number | null;
  event_credits_total: number | null;
  end_date: string | null;
  is_frozen: boolean;
};

const emptyCounts = (): Record<AtRiskReason, number> => ({
  "Congelada": 0, "Sin créditos": 0, "Pocos créditos": 0, "Caduca pronto": 0,
  "Sin venir": 0, "Asistencia en caída": 0,
});

// Lee todas las filas paginando (PostgREST corta en 1000).
async function readAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
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

// Suscripciones/packs que necesitan atención (retención), desde el snapshot v2.
export async function getAtRiskV2(): Promise<AtRiskV2> {
  const db = createServerClient();
  const { data: latest } = await db
    .from("subscriber_snapshots_v2")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  const date = (latest?.[0]?.date as string | undefined) ?? null;
  if (!date) return { date: null, items: [], counts: emptyCounts() };

  const { data } = await db
    .from("subscriber_snapshots_v2")
    .select("member_id, email, membership_name, type, start_date, event_credits_left, event_credits_total, end_date, is_frozen")
    .eq("date", date);
  const rows = (data ?? []) as Row[];

  const now = Date.now();
  const items: AtRiskItem[] = [];

  for (const r of rows) {
    if (r.is_frozen) {
      items.push({ memberId: r.member_id, email: r.email, membershipName: r.membership_name, type: r.type, reason: "Congelada", detail: "congelada", severity: 4 });
      continue;
    }

    // Solo packs multi-clase (excluye "clase suelta" y suscripciones).
    const total = r.event_credits_total ?? 0;
    if (r.type !== "package-events" || total <= 1) continue;

    const left = r.event_credits_left;
    const days = r.end_date ? Math.round((Date.parse(r.end_date) - now) / 86_400_000) : null;

    if (left !== null && left <= 0) {
      items.push({ memberId: r.member_id, email: r.email, membershipName: r.membership_name, type: r.type, reason: "Sin créditos", detail: `0 de ${total} clases`, severity: 3 });
    } else if (left !== null && left > 0 && left <= LOW_CREDITS && left < total) {
      items.push({ memberId: r.member_id, email: r.email, membershipName: r.membership_name, type: r.type, reason: "Pocos créditos", detail: `${left} de ${total} clases`, severity: 2 });
    } else if (days !== null && days >= 0 && days <= EXPIRING_DAYS) {
      items.push({ memberId: r.member_id, email: r.email, membershipName: r.membership_name, type: r.type, reason: "Caduca pronto", detail: `caduca en ${days} d`, severity: 1 });
    }
  }

  // ── Churn temprano por comportamiento: suscripciones activas × asistencia real ──
  // Solo suscripciones (los packs ya se vigilan por créditos) no congeladas, una señal por
  // miembro. Una sola lectura de todos los check-ins da la última clase de cada miembro (para
  // "sin venir") y las dos ventanas de DROP_WINDOW días (para "asistencia en caída").
  const checkins = await readAllRows<{ member_id: number; session_starts_at: string }>((from, to) =>
    db
      .from("class_bookings_v2")
      .select("member_id, session_starts_at")
      .eq("checked_in", true)
      .range(from, to),
  ).catch(() => []);

  const lastByMember = new Map<number, string>();
  const recentByMember = new Map<number, { last28: number; prev28: number }>();
  const cutRecent = now - DROP_WINDOW * 86_400_000;
  const cutPrev = now - 2 * DROP_WINDOW * 86_400_000;
  for (const b of checkins) {
    const prev = lastByMember.get(b.member_id);
    if (!prev || b.session_starts_at > prev) lastByMember.set(b.member_id, b.session_starts_at);
    const t = Date.parse(b.session_starts_at);
    if (t < cutPrev) continue;
    const acc = recentByMember.get(b.member_id) ?? { last28: 0, prev28: 0 };
    if (t >= cutRecent) acc.last28 += 1;
    else acc.prev28 += 1;
    recentByMember.set(b.member_id, acc);
  }

  const flaggedMembers = new Set<number>();
  for (const r of rows) {
    if (r.is_frozen) continue;
    if (r.type !== "subscription" && r.type !== "on-demand-subscription") continue;
    if (flaggedMembers.has(r.member_id)) continue; // una señal por miembro (puede tener 2 subs)

    const last = lastByMember.get(r.member_id);
    if (!last) continue; // nunca ha pisado clase (o sin datos capturados): sin línea base, no juzgamos
    const daysSince = Math.floor((now - Date.parse(last)) / 86_400_000);
    // Con suscripción recién empezada no hay línea base suficiente.
    const subAgeDays = r.start_date ? Math.floor((now - Date.parse(r.start_date)) / 86_400_000) : null;
    if (subAgeDays !== null && subAgeDays < INACTIVE_DAYS) continue;

    if (daysSince >= INACTIVE_DAYS) {
      items.push({
        memberId: r.member_id, email: r.email, membershipName: r.membership_name, type: r.type,
        reason: "Sin venir", detail: `última clase hace ${daysSince} d`, severity: 3,
      });
      flaggedMembers.add(r.member_id);
      continue;
    }

    const rec = recentByMember.get(r.member_id);
    if (rec && rec.prev28 >= DROP_MIN_BASE && rec.last28 <= rec.prev28 / 2) {
      items.push({
        memberId: r.member_id, email: r.email, membershipName: r.membership_name, type: r.type,
        reason: "Asistencia en caída", detail: `${rec.prev28} → ${rec.last28} clases en ${DROP_WINDOW} d`, severity: 2,
      });
      flaggedMembers.add(r.member_id);
    }
  }

  items.sort((a, b) => b.severity - a.severity || a.membershipName.localeCompare(b.membershipName));

  const counts = emptyCounts();
  for (const it of items) counts[it.reason]++;

  return { date, items, counts };
}
