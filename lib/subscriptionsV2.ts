import { unstable_cache } from "next/cache";
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
export async function getSubscriptionsBaseV2(tiers: SubscriptionTier[]): Promise<SubscriptionsBaseV2> {
  const priceByName = new Map(tiers.map((t) => [t.name, t.price]));
  const empty: SubscriptionsBaseV2 = {
    date: null, tiers: [], totalSubscriptions: 0, totalMembers: 0, totalMrr: 0, totalArr: 0,
  };

  const { date, rows } = await fetchActiveSubscriptionSnapshot();
  if (!date) return empty;

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
