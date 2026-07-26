import { NextResponse } from "next/server";
import { getEvents, MomenceEvent } from "@/lib/momence";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const madridDay = (dt: string | Date) =>
  new Date(dt).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

// Sonda READ-ONLY de recuperación del histórico de clases. NO escribe nada.
//
// La API de Momence sigue devolviendo clases pasadas durante una ventana, así
// que las clases que se perdieron por el bug de congelación (ver lib/history.ts)
// puede que aún se puedan recuperar. Este endpoint compara lo guardado con lo
// que la API devuelve hoy y, para cada día cerrado incompleto, calcula la lista
// COMPLETA de clases (fusión aditiva: lo guardado manda, solo se añaden las que
// faltan; nunca degrada la ocupación ya registrada). Devuelve esos payloads
// para poder aplicarlos luego de forma controlada desde local.
//
// Sin auth, igual que /api/momence-probe. Endpoint temporal: se puede borrar
// una vez hecha la recuperación.
export async function GET() {
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
  const { data: existing, error } = await db
    .from("momence_history")
    .select("date, events")
    .in("date", days);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const storedByDay = new Map<string, MomenceEvent[]>(
    (existing ?? []).map((r) => [r.date as string, (r.events ?? []) as MomenceEvent[]]),
  );

  const report: { day: string; stored: number; live: number; merged: number; action: string }[] = [];
  const payloads: { date: string; op: "insert" | "update"; events: MomenceEvent[] }[] = [];

  for (const day of days) {
    const live = liveByDay.get(day)!;
    const hasStored = storedByDay.has(day);
    const stored = storedByDay.get(day) ?? [];

    // Unión por id, aditiva: lo guardado manda en los solapes.
    const byId = new Map<number, MomenceEvent>();
    for (const e of live) byId.set(e.id, e);
    for (const e of stored) byId.set(e.id, e);
    const merged = [...byId.values()].sort(
      (a, b) => +new Date(a.dateTime) - +new Date(b.dateTime),
    );

    let action = "sin cambios";
    if (!hasStored) {
      payloads.push({ date: day, op: "insert", events: merged });
      action = `insertar (${merged.length})`;
    } else if (merged.length > stored.length) {
      payloads.push({ date: day, op: "update", events: merged });
      action = `rellenar (${stored.length}→${merged.length})`;
    }
    report.push({ day, stored: stored.length, live: live.length, merged: merged.length, action });
  }

  return NextResponse.json({
    liveWindow: {
      oldestClosedDay: days[0] ?? null,
      newestClosedDay: days.at(-1) ?? null,
      totalClosedDays: days.length,
    },
    changes: payloads.map((p) => ({ date: p.date, op: p.op, count: p.events.length })),
    report,
    payloads,
  });
}
