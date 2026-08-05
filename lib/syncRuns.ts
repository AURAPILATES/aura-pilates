import { unstable_cache } from "next/cache";
import { createServerClient } from "./supabase";
import { sendSyncFailureAlert } from "./alertEmail";

export type SyncSource = "momence_events" | "momence_subscribers" | "momence_subscribers_v2" | "momence_attendance_v2";

// Deja constancia de cada ejecución de los cron de Momence (éxito o fallo),
// para poder distinguir "no había nada que sincronizar" de "la sync falló
// y ese día no se guardó histórico". Si el propio logging falla, no debe
// tapar el error original del cron.
export async function logSyncRun(
  source: SyncSource,
  result: { ok: true; items: number } | { ok: false; error: string },
) {
  try {
    const db = createServerClient();
    await db.from("sync_runs").insert({
      source,
      ok: result.ok,
      items: result.ok ? result.items : null,
      error: result.ok ? null : result.error,
    });
  } catch (e) {
    console.error(`logSyncRun(${source}) failed:`, e);
  }

  if (!result.ok) {
    await sendSyncFailureAlert(source, result.error);
  }
}

// Cacheado (30 min): es un banner puramente informativo ("¿falló el último snapshot?"), no hace
// falta reconsultarlo en cada carga de Analítica. Invalidable a mano con revalidateTag("momence").
export const getLatestSyncRuns = unstable_cache(
  async (): Promise<
    Record<SyncSource, { ok: boolean; ranAt: string; items: number | null; error: string | null } | null>
  > => {
    const db = createServerClient();
    const sources: SyncSource[] = ["momence_events", "momence_subscribers"];
    const result: Record<string, { ok: boolean; ranAt: string; items: number | null; error: string | null } | null> = {};

    await Promise.all(
      sources.map(async (source) => {
        const { data } = await db
          .from("sync_runs")
          .select("ok, ran_at, items, error")
          .eq("source", source)
          .order("ran_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        result[source] = data ? { ok: data.ok, ranAt: data.ran_at, items: data.items, error: data.error } : null;
      }),
    );

    return result as Record<SyncSource, { ok: boolean; ranAt: string; items: number | null; error: string | null } | null>;
  },
  ["latest-sync-runs"],
  { revalidate: 1800, tags: ["momence"] },
);
