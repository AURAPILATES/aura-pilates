import { NextResponse } from "next/server";
import { getEvents, MomenceEvent } from "@/lib/momence";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const madridDay = (dt: string | Date) =>
  new Date(dt).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

// Sonda + recuperación de días cerrados cuyo histórico quedó incompleto por el
// bug de congelación (ver lib/history.ts): la API de Momence sigue devolviendo
// clases pasadas durante una ventana, así que algunas de las que se perdieron
// puede que aún se puedan recuperar.
//
// La recuperación es SOLO ADITIVA: para clases que ya están guardadas se
// respeta lo almacenado; solo se añaden clases que faltaban. Nunca degrada la
// ocupación ya registrada.
//
// Uso:
//   GET /api/recover-events?secret=<CRON_SECRET>          -> dry-run (no escribe)
//   GET /api/recover-events?secret=<CRON_SECRET>&apply=1  -> aplica los cambios
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const authHeader = req.headers.get("authorization");
  const authorized =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secret === process.env.CRON_SECRET;
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apply = url.searchParams.get("apply") === "1";

  const events = await getEvents();
  const todayKey = madridDay(new Date());

  // Clases de días ya cerrados que la API sigue devolviendo.
  const liveByDay = new Map<string, MomenceEvent[]>();
  for (const e of events) {
    if (!e.published || e.isCancelled || e.isDeleted) continue;
    const day = madridDay(e.dateTime);
    if (day >= todayKey) continue;
    if (!liveByDay.has(day)) liveByDay.set(day, []);
    liveByDay.get(day)!.push(e);
  }

  const days = [...liveByDay.keys()].sort();
  const db = createServerClient();
  const { data: existing, error: readError } = await db
    .from("momence_history")
    .select("date, events")
    .in("date", days);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  const storedByDay = new Map<string, MomenceEvent[]>(
    (existing ?? []).map((r) => [r.date as string, (r.events ?? []) as MomenceEvent[]]),
  );

  const toInsert: { date: string; events: MomenceEvent[] }[] = [];
  const toUpdate: { date: string; events: MomenceEvent[] }[] = [];
  const report: { day: string; stored: number; live: number; merged: number; action: string }[] = [];

  for (const day of days) {
    const live = liveByDay.get(day)!;
    const hasStored = storedByDay.has(day);
    const stored = storedByDay.get(day) ?? [];

    // Unión por id, aditiva: lo almacenado manda en los solapes; solo se
    // incorporan clases nuevas que la API trae y no teníamos.
    const byId = new Map<number, MomenceEvent>();
    for (const e of live) byId.set(e.id, e);
    for (const e of stored) byId.set(e.id, e);
    const merged = [...byId.values()].sort(
      (a, b) => +new Date(a.dateTime) - +new Date(b.dateTime),
    );

    let action = "sin cambios";
    if (!hasStored) {
      toInsert.push({ date: day, events: merged });
      action = `insertar (${merged.length})`;
    } else if (merged.length > stored.length) {
      toUpdate.push({ date: day, events: merged });
      action = `rellenar (${stored.length}→${merged.length})`;
    }
    report.push({ day, stored: stored.length, live: live.length, merged: merged.length, action });
  }

  let inserted = 0;
  let updated = 0;
  if (apply) {
    if (toInsert.length) {
      const { error } = await db.from("momence_history").insert(toInsert);
      if (error) return NextResponse.json({ error: `insert: ${error.message}`, report }, { status: 500 });
      inserted = toInsert.length;
    }
    for (const u of toUpdate) {
      const { error } = await db.from("momence_history").update({ events: u.events }).eq("date", u.date);
      if (error) return NextResponse.json({ error: `update ${u.date}: ${error.message}`, report }, { status: 500 });
      updated++;
    }
  }

  return NextResponse.json({
    apply,
    liveWindow: {
      oldestClosedDay: days[0] ?? null,
      newestClosedDay: days[days.length - 1] ?? null,
      totalClosedDays: days.length,
    },
    plan: { insert: toInsert.map((d) => d.date), update: toUpdate.map((d) => d.date) },
    result: apply ? { inserted, updated } : "dry-run (añade &apply=1 para escribir)",
    report,
  });
}
