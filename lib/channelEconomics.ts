import type { ChannelMonthActivity } from "./clientActivityV2";

/** Subconjunto de IngresosPorFuenteRow (app/analitica/instances/IngresosPorFuenteBody.tsx)
 * que necesita este cálculo - se tipa aquí en vez de importar del árbol de app/ para no invertir
 * la dependencia lib → app. */
type MonthlyRevenueRow = { month: string; label: string; stripeGross: number; uscNet: number; urbanClasses: number };

export type ChannelEconomicsRow = {
  month: string;
  label: string;
  stripeClasses: number;
  stripeRevenue: number;
  stripePerClass: number | null;
  urbanClasses: number;
  urbanRevenue: number;
  urbanPerClass: number | null;
};

// € por clase asistida, por canal: Stripe (interno, precio de venta ÷ clases realmente
// asistidas por miembros no-Urban) vs Urban Sports Club (importe asignado a ese mes ÷ clases
// asistidas por miembros Urban). Responde si el canal Urban compensa al ritmo de tarifa actual
// frente a lo que deja un cliente interno de media. Ver [[project-momence-sales-migration]].
export function buildChannelEconomics(
  monthly: MonthlyRevenueRow[],
  channelActivity: Map<string, ChannelMonthActivity>,
): ChannelEconomicsRow[] {
  return monthly
    .map((r) => {
      const activity = channelActivity.get(r.month);
      const stripeClasses = activity?.internalClasses ?? 0;
      const urbanClasses = r.urbanClasses;
      return {
        month: r.month,
        label: r.label,
        stripeClasses,
        stripeRevenue: r.stripeGross,
        stripePerClass: stripeClasses > 0 ? r.stripeGross / stripeClasses : null,
        urbanClasses,
        urbanRevenue: r.uscNet,
        urbanPerClass: urbanClasses > 0 ? r.uscNet / urbanClasses : null,
      };
    })
    .filter((r) => r.stripeClasses > 0 || r.urbanClasses > 0);
}
