import { NextResponse } from "next/server";
import { getEvents } from "@/lib/momence";
import { saveHistoricalEvents } from "@/lib/history";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const events = await getEvents();
  await saveHistoricalEvents(events);

  return NextResponse.json({ date: new Date().toISOString().slice(0, 10), fetched: events.length });
}
