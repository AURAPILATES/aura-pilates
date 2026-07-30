import { NextResponse } from "next/server";
import { captureAttendanceWindow } from "@/lib/attendanceCaptureV2";
import { createServerClient } from "@/lib/supabase";
import { logSyncRun } from "@/lib/syncRuns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Captura diaria de asistencia real (checkedIn) por clase desde la API v2 de Momence.
// Por defecto recaptura una ventana rolling de los últimos días: una clase solo tiene
// asistencia definitiva cuando ya pasó, y así se fijan los check-ins tardíos.
//
// El histórico completo (desde el arranque en Momence) no cabe en 60s (~70s para 615
// clases), así que va por el backfill one-shot: scripts/backfill-attendance-v2.mjs.
// También acepta ?from=YYYY-MM-DD&to=YYYY-MM-DD para recapturar una ventana concreta.
const ROLLING_DAYS = 10;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const now = Date.now();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const startAfter = from
    ? new Date(from + "T00:00:00.000Z").toISOString()
    : new Date(now - ROLLING_DAYS * 864e5).toISOString();
  const startBefore = to
    ? new Date(to + "T23:59:59.999Z").toISOString()
    : new Date(now).toISOString();

  try {
    const db = createServerClient();
    const res = await captureAttendanceWindow(db, startAfter, startBefore);
    await logSyncRun("momence_attendance_v2", { ok: true, items: res.sessions });
    return NextResponse.json({ ok: true, ...res, startAfter, startBefore });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSyncRun("momence_attendance_v2", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
