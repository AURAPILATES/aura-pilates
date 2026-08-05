import { unstable_cache } from "next/cache";
import { createServerClient } from "./supabase";
import type { SessionOccRow } from "./analytics";

// Fetch de asistencia real por clase (class_sessions_v2, migración 027) para alimentar la
// evolución de ocupación + mapa de calor de Horario/Analítica. La agregación en sí (por
// período, por día×hora) vive en lib/analytics.ts junto al resto de funciones de ocupación,
// porque esas son puras y las necesita un client component (no pueden importar unstable_cache).
// Ver [[project-profesoras-v2]].
//
// class_sessions_v2 solo contiene clases YA IMPARTIDAS (checkedIn no es definitivo hasta que la
// clase pasa, ver lib/attendanceCaptureV2.ts) - a diferencia de la API interna, no incluye
// clases futuras.

async function fetchSessionOccupancyRows(from: string, to: string): Promise<SessionOccRow[]> {
  const db = createServerClient();
  // PostgREST corta en 1000 filas; paginamos para no perder clases en rangos largos
  // (año / todo el histórico), mismo patrón que getTeacherStatsV2.
  const PAGE = 1000;
  const rows: SessionOccRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await db
      .from("class_sessions_v2")
      .select("starts_at, teacher_name, capacity, booking_count, checked_in_count")
      .eq("is_cancelled", false)
      .gte("starts_at", from + "T00:00:00.000Z")
      .lte("starts_at", to + "T23:59:59.999Z")
      .order("starts_at", { ascending: true })
      .range(offset, offset + PAGE - 1);
    const batch = (data ?? []) as SessionOccRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

// Cacheada (30 min, invalidable con el botón de sincronizar) - mismo patrón que
// getTeacherStatsV2, que lee la misma tabla para el mismo rango.
export const getSessionOccupancyRowsV2 = unstable_cache(
  fetchSessionOccupancyRows,
  ["session-occupancy-v2"],
  { revalidate: 1800, tags: ["momence"] },
);
