import { NextResponse } from "next/server";
import { getMembersV2, getMemberBoughtMembershipsV2 } from "@/lib/momenceV2";
import { createServerClient } from "@/lib/supabase";
import { logSyncRun } from "@/lib/syncRuns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Snapshot diario de suscripciones desde la API pública v2 de Momence.
// Sustituye a snapshot-subscribers (API interna), que infra-contaba ~3,7×
// (22 vs 84 suscripciones reales, verificado 2026-07-30). Escribe una fila por
// bought-membership activa en subscriber_snapshots_v2. Corre en paralelo al
// interno hasta que se retire. Ver [[project-momence-v2]].
//
// Las suscripciones de v2 no vienen en un solo endpoint: hay que pedir las
// bought-memberships miembro a miembro (N+1). Se lanzan en lotes paralelos para
// entrar holgado en maxDuration.
const BATCH_SIZE = 10;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const members = await getMembersV2({ filterPreset: "with-active-membership" });

    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < members.length; i += BATCH_SIZE) {
      const chunk = members.slice(i, i + BATCH_SIZE);
      const chunkRows = await Promise.all(
        chunk.map(async (m) => {
          const subs = await getMemberBoughtMembershipsV2(m.id);
          return subs.map((s) => ({
            date: today,
            member_id: m.id,
            email: m.email,
            bought_membership_id: s.id,
            membership_id: s.membership?.id ?? null,
            membership_name: s.membership?.name ?? null,
            type: s.type,
            start_date: s.startDate,
            end_date: s.endDate,
            is_frozen: s.isFrozen,
            event_credits_left: s.eventCreditsLeft,
            event_credits_total: s.eventCreditsTotal,
            money_credits_left: s.moneyCreditsLeft,
            money_credits_total: s.moneyCreditsTotal,
          }));
        }),
      );
      for (const r of chunkRows) rows.push(...r);
    }

    if (rows.length === 0) {
      await logSyncRun("momence_subscribers_v2", { ok: true, items: 0 });
      return NextResponse.json({ date: today, snapshotted: 0, members: members.length });
    }

    const db = createServerClient();
    const { error } = await db
      .from("subscriber_snapshots_v2")
      .upsert(rows, { onConflict: "date,bought_membership_id" });
    if (error) throw new Error(error.message);

    await logSyncRun("momence_subscribers_v2", { ok: true, items: rows.length });
    return NextResponse.json({ date: today, snapshotted: rows.length, members: members.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSyncRun("momence_subscribers_v2", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
