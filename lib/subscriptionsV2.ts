import { unstable_cache } from "next/cache";
import { createServerClient } from "./supabase";
import type { SubscriptionTier } from "./mrr";

export type TierMember = { memberId: number; email: string };

export type TierMrrV2 = {
  name: string;
  price: number;       // precio mensual del plan (del catálogo de Momence)
  activeCount: number; // suscripciones activas (no congeladas) de ese plan
  mrr: number;         // activeCount * price
  arr: number;         // mrr * 12
  /** Miembros con esta suscripción activa, para el drawer al clicar la fila. */
  members: TierMember[];
};

export type SubscriptionsBaseV2 = {
  date: string | null;   // fecha del snapshot usado
  tiers: TierMrrV2[];
  totalSubscriptions: number; // suma de suscripciones activas (cuadra con el panel de Momence)
  totalMembers: number;       // personas distintas con alguna suscripción activa
  totalMrr: number;
  totalArr: number;
};

type ActiveSubRow = { member_id: number; membership_name: string; email: string };

// Cacheado (30 min, invalidable con el botón de sincronizar): getActiveSubscriberEmailsV2 y
// getSubscriptionsBaseV2 hacían cada una su propia búsqueda de "último snapshot" + su propio
// filtro (misma tabla, mismas condiciones type=subscription/is_frozen=false), sin caché. Se
// comparte una única lectura.
const fetchActiveSubscriptionSnapshot = unstable_cache(
  async (): Promise<{ date: string | null; rows: ActiveSubRow[] }> => {
    const db = createServerClient();
    const { data: latest } = await db
      .from("subscriber_snapshots_v2")
      .select("date")
      .order("date", { ascending: false })
      .limit(1);
    const date = (latest?.[0]?.date as string | undefined) ?? null;
    if (!date) return { date: null, rows: [] };
    const { data } = await db
      .from("subscriber_snapshots_v2")
      .select("member_id, membership_name, email")
      .eq("date", date)
      .eq("type", "subscription")
      .eq("is_frozen", false);
    return { date, rows: (data ?? []) as ActiveSubRow[] };
  },
  ["active-subscription-snapshot-v2"],
  { revalidate: 1800, tags: ["momence"] },
);

// Emails (en minúscula) con una suscripción activa NO congelada en el último
// snapshot v2. Fuente de verdad de "quién sigue suscrito ahora mismo en Momence",
// para cruzar con las inferencias por Stripe (churn/convertir) y quitar falsos
// positivos. Devuelve Set vacío si aún no hay snapshot.
export async function getActiveSubscriberEmailsV2(): Promise<Set<string>> {
  const { rows } = await fetchActiveSubscriptionSnapshot();
  return new Set(rows.map((r) => r.email.toLowerCase()));
}

// Base real de suscripción desde el snapshot v2 (subscriber_snapshots_v2), que a
// diferencia de la API interna captura TODAS las suscripciones (~84 vs ~22).
// Cuenta por suscripción (fila), igual que el panel de Momence: si una persona
// tiene 2 subs del mismo plan, cuentan las 2 (Momence las factura por separado).
// `tiers` aporta los precios (del catálogo de membresías).
export type MrrHistoryPoint = {
  date: string;
  totalSubscriptions: number;
  totalMrr: number;
  totalArr: number;
};

// Evolución diaria de MRR/ARR desde que existe snapshot v2 (30-jul-2026 en adelante - el
// snapshot es una foto del presente en cada corte, Momence no expone histórico de suscripciones
// retroactivo, así que no hay forma de completar hacia atrás). Usa los precios ACTUALES del
// catálogo para todas las fechas (no hay log histórico de cambios de precio); a corto plazo el
// margen de error es mínimo. Ver [[project-momence-v2]].
export async function getMrrHistoryV2(tiers: SubscriptionTier[]): Promise<MrrHistoryPoint[]> {
  const priceByName = new Map(tiers.map((t) => [t.name, t.price]));
  const db = createServerClient();

  const PAGE = 1000;
  const rows: { date: string; membership_name: string }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await db
      .from("subscriber_snapshots_v2")
      .select("date, membership_name")
      .eq("type", "subscription")
      .eq("is_frozen", false)
      .order("date", { ascending: true })
      .range(offset, offset + PAGE - 1);
    const batch = (data ?? []) as { date: string; membership_name: string }[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  if (rows.length === 0) return [];

  const byDate = new Map<string, number>(); // date -> count total
  const byDateTier = new Map<string, Map<string, number>>();
  for (const r of rows) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + 1);
    const tierMap = byDateTier.get(r.date) ?? new Map<string, number>();
    tierMap.set(r.membership_name, (tierMap.get(r.membership_name) ?? 0) + 1);
    byDateTier.set(r.date, tierMap);
  }

  return Array.from(byDate.keys())
    .sort()
    .map((date) => {
      const tierMap = byDateTier.get(date)!;
      let totalMrr = 0;
      for (const [name, count] of tierMap) totalMrr += count * (priceByName.get(name) ?? 0);
      return { date, totalSubscriptions: byDate.get(date)!, totalMrr, totalArr: totalMrr * 12 };
    });
}

export async function getSubscriptionsBaseV2(tiers: SubscriptionTier[]): Promise<SubscriptionsBaseV2> {
  const priceByName = new Map(tiers.map((t) => [t.name, t.price]));
  const empty: SubscriptionsBaseV2 = {
    date: null, tiers: [], totalSubscriptions: 0, totalMembers: 0, totalMrr: 0, totalArr: 0,
  };

  const { date, rows } = await fetchActiveSubscriptionSnapshot();
  if (!date) return empty;

  const membersByName = new Map<string, TierMember[]>();
  const members = new Set<number>();
  for (const r of rows) {
    const list = membersByName.get(r.membership_name) ?? [];
    list.push({ memberId: r.member_id, email: r.email });
    membersByName.set(r.membership_name, list);
    members.add(r.member_id);
  }

  const tierRows: TierMrrV2[] = [...membersByName.entries()]
    .map(([name, tierMembers]) => {
      const price = priceByName.get(name) ?? 0;
      const activeCount = tierMembers.length;
      const mrr = activeCount * price;
      return { name, price, activeCount, mrr, arr: mrr * 12, members: tierMembers };
    })
    .sort((a, b) => b.mrr - a.mrr || b.activeCount - a.activeCount);

  const totalSubscriptions = rows.length;
  const totalMrr = tierRows.reduce((s, t) => s + t.mrr, 0);

  return {
    date,
    tiers: tierRows,
    totalSubscriptions,
    totalMembers: members.size,
    totalMrr,
    totalArr: totalMrr * 12,
  };
}
