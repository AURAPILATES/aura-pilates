import { createServerClient } from "./supabase";

// Umbrales (ajustables): "pocos créditos" = quedan ≤2 y ya ha usado alguno;
// "caduca pronto" = vence dentro de estos días. Se excluyen los one-off de una
// sola clase (total ≤ 1): no son target de retención.
const LOW_CREDITS = 2;
const EXPIRING_DAYS = 14;

export type AtRiskReason = "Congelada" | "Sin créditos" | "Pocos créditos" | "Caduca pronto";

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
  event_credits_left: number | null;
  event_credits_total: number | null;
  end_date: string | null;
  is_frozen: boolean;
};

const emptyCounts = (): Record<AtRiskReason, number> => ({
  "Congelada": 0, "Sin créditos": 0, "Pocos créditos": 0, "Caduca pronto": 0,
});

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
    .select("member_id, email, membership_name, type, event_credits_left, event_credits_total, end_date, is_frozen")
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

  items.sort((a, b) => b.severity - a.severity || a.membershipName.localeCompare(b.membershipName));

  const counts = emptyCounts();
  for (const it of items) counts[it.reason]++;

  return { date, items, counts };
}
