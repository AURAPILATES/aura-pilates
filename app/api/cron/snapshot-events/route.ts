import { NextResponse } from "next/server";
import { getEvents } from "@/lib/momence";
import { saveHistoricalEvents } from "@/lib/history";
import { logSyncRun } from "@/lib/syncRuns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const events = await getEvents();
    await saveHistoricalEvents(events);
    await logSyncRun("momence_events", { ok: true, items: events.length });
    return NextResponse.json({ date: new Date().toISOString().slice(0, 10), fetched: events.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logSyncRun("momence_events", { ok: false, error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
