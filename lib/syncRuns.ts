import { createServerClient } from "./supabase";
import { sendSyncFailureAlert } from "./alertEmail";

export type SyncSource = "momence_events" | "momence_subscribers";

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

export async function getLatestSyncRuns(): Promise<
  Record<SyncSource, { ok: boolean; ranAt: string; items: number | null; error: string | null } | null>
> {
  const db = createServerClient();
  const sources: SyncSource[] = ["momence_events", "momence_subscribers"];
  const result: Record<string, { ok: boolean; ranAt: string; items: number | null; error: string | null } | null> = {};

  for (const source of sources) {
    const { data } = await db
      .from("sync_runs")
      .select("ok, ran_at, items, error")
      .eq("source", source)
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    result[source] = data ? { ok: data.ok, ranAt: data.ran_at, items: data.items, error: data.error } : null;
  }

  return result as Record<SyncSource, { ok: boolean; ranAt: string; items: number | null; error: string | null } | null>;
}
