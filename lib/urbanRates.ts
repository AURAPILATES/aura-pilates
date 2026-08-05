import { unstable_cache } from "next/cache";
import { createServerClient } from "./supabase";

// Tarifas pactadas con Urban Sports Club (€ por clase asistida), con vigencia por rango de
// fechas (migración 028). Momence no expone lo que Urban paga, así que la tarifa se define aquí
// a mano y con ella estimamos en vivo el € de Urban del mes en curso (check-ins × tarifa) antes
// de que llegue la transferencia del banco. Ver [[project-momence-sales-migration]].

export type UrbanRate = {
  id: string;
  start_date: string;        // "YYYY-MM-DD" inclusive
  end_date: string | null;   // "YYYY-MM-DD" inclusive; null = vigente
  price_per_class: number;
};

// Cacheado (30 min): se edita muy de vez en cuando desde Config → Precios, que invalida el
// caché al guardar (revalidateTag("urban_rates")), así que un cambio se ve al instante igual.
export const loadUrbanRates = unstable_cache(
  async (): Promise<UrbanRate[]> => {
    const db = createServerClient();
    const { data, error } = await db
      .from("urban_rates")
      .select("id, start_date, end_date, price_per_class")
      .order("start_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      start_date: r.start_date,
      end_date: r.end_date,
      price_per_class: Number(r.price_per_class),
    }));
  },
  ["urban-rates"],
  { revalidate: 1800, tags: ["urban_rates"] },
);

// Tarifa aplicable a una fecha de clase ("YYYY-MM-DD"). Devuelve el € por clase o null si no
// hay ninguna tarifa que cubra esa fecha (entonces no se estima nada para esa clase). Si dos
// rangos se solapasen, gana el de start_date más reciente (rates viene ordenado desc).
export function rateForDate(rates: UrbanRate[], dateISO: string): number | null {
  const d = dateISO.slice(0, 10);
  for (const r of rates) {
    if (r.start_date <= d && (r.end_date == null || d <= r.end_date)) {
      return r.price_per_class;
    }
  }
  return null;
}
