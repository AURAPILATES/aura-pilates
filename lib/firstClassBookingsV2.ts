import { unstable_cache } from "next/cache";
import { createServerClient } from "./supabase";

// Primera clase asistida de cada miembro (member_id, email, profesora, fecha) desde
// class_bookings_v2 (checked_in=true). Lo usan lib/teacherConversionV2.ts (conversión por
// profesora) y lib/subscriberFirstClassV2.ts (primera clase de los suscriptores) - antes cada
// uno hacía su propia lectura completa e idéntica de la tabla en cada carga de Analítica, sin
// caché. Cacheado 30 min, invalidable a mano con el botón de sincronizar (revalidateTag("momence")).

export type FirstClassRow = {
  member_id: number;
  email: string | null;
  teacher_name: string;
  session_starts_at: string;
};

export const fetchCheckedInFirstClassRows = unstable_cache(
  async (): Promise<FirstClassRow[]> => {
    const db = createServerClient();
    // PostgREST corta las lecturas en 1000 filas; class_bookings_v2 ya supera eso (>2000),
    // así que paginamos con range() hasta agotar. Sin esto, se perderían las reservas más
    // recientes y la conversión/primera-clase quedarían infravaloradas.
    const PAGE = 1000;
    const rows: FirstClassRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data } = await db
        .from("class_bookings_v2")
        .select("member_id, email, teacher_name, session_starts_at")
        .eq("checked_in", true)
        .order("session_starts_at", { ascending: true })
        .range(from, from + PAGE - 1);
      const batch = (data ?? []) as FirstClassRow[];
      rows.push(...batch);
      if (batch.length < PAGE) break;
    }
    return rows;
  },
  ["checked-in-first-class-rows-v2"],
  { revalidate: 1800, tags: ["momence"] },
);
