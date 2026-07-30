import { createServerClient } from "./supabase";
import type { SubscriptionTier } from "./mrr";

export type TierMrrV2 = {
  name: string;
  price: number;       // precio mensual del plan (del catálogo de Momence)
  activeCount: number; // suscripciones activas (no congeladas) de ese plan
  mrr: number;         // activeCount * price
  arr: number;         // mrr * 12
};

export type SubscriptionsBaseV2 = {
  date: string | null;   // fecha del snapshot usado
  tiers: TierMrrV2[];
  totalSubscriptions: number; // suma de suscripciones activas (cuadra con el panel de Momence)
  totalMembers: number;       // personas distintas con alguna suscripción activa
  totalMrr: number;
  totalArr: number;
};

// Base real de suscripción desde el snapshot v2 (subscriber_snapshots_v2), que a
// diferencia de la API interna captura TODAS las suscripciones (~84 vs ~22).
// Cuenta por suscripción (fila), igual que el panel de Momence: si una persona
// tiene 2 subs del mismo plan, cuentan las 2 (Momence las factura por separado).
// `tiers` aporta los precios (del catálogo de membresías).
export async function getSubscriptionsBaseV2(tiers: SubscriptionTier[]): Promise<SubscriptionsBaseV2> {
  const priceByName = new Map(tiers.map((t) => [t.name, t.price]));
  const empty: SubscriptionsBaseV2 = {
    date: null, tiers: [], totalSubscriptions: 0, totalMembers: 0, totalMrr: 0, totalArr: 0,
  };

  const db = createServerClient();
  const { data: latest } = await db
    .from("subscriber_snapshots_v2")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  const date = (latest?.[0]?.date as string | undefined) ?? null;
  if (!date) return empty;

  const { data } = await db
    .from("subscriber_snapshots_v2")
    .select("member_id, membership_name")
    .eq("date", date)
    .eq("type", "subscription")
    .eq("is_frozen", false);

  const rows = (data ?? []) as { member_id: number; membership_name: string }[];

  const countByName = new Map<string, number>();
  const members = new Set<number>();
  for (const r of rows) {
    countByName.set(r.membership_name, (countByName.get(r.membership_name) ?? 0) + 1);
    members.add(r.member_id);
  }

  const tierRows: TierMrrV2[] = [...countByName.entries()]
    .map(([name, activeCount]) => {
      const price = priceByName.get(name) ?? 0;
      const mrr = activeCount * price;
      return { name, price, activeCount, mrr, arr: mrr * 12 };
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
