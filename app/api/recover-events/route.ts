import { NextResponse } from "next/server";
import { getEvents, MomenceEvent } from "@/lib/momence";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const madridDay = (dt: string | Date) =>
  new Date(dt).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

// Sonda READ-ONLY. NO escribe nada. Dos objetivos:
//  1) Diagnóstico: qué ventana de días devuelve hoy la API de Momence
//     (pasado / hoy / futuro), para saber si los días perdidos por el bug de
//     congelación aún se pueden recuperar desde la API.
//  2) Recuperación: para cada día ANTERIOR a hoy que la API aún devuelva y esté
//     incompleto en el histórico, calcula la lista completa fusionada (aditiva:
//     lo guardado manda, solo se añade lo que falta) para aplicarla luego desde
//     local de forma controlada.
//
// Sin auth, igual que /api/momence-probe. Endpoint temporal.
export async function GET() {
  const events = await getEvents();
  const todayKey = madridDay(new Date());

  // --- Diagnóstico de la ventana de la API ---
  const dayCounts: Record<string, number> = {};
  let minDt: string | null = null;
  let maxDt: string | null = null;
  for (const e of events) {
    const day = madridDay(e.dateTime);
    dayCounts[day] = (dayCounts[day] ?? 0) + 1;
    if (!minDt || e.dateTime < minDt) minDt = e.dateTime;
    if (!maxDt || e.dateTime > maxDt) maxDt = e.dateTime;
  }
  const allDays = Object.keys(dayCounts).sort();
  const pastDaysReturned = allDays.filter((d) => d < todayKey);

  // --- Recuperación (solo días cerrados que la API aún devuelve) ---
  const liveByDay = new Map<string, MomenceEvent[]>();
  for (const e of events) {
    if (!e.published || e.isCancelled || e.isDeleted) continue;
    const day = madridDay(e.dateTime);
    if (day >= todayKey) continue;
    if (!liveByDay.has(day)) liveByDay.set(day, []);
    liveByDay.get(day)!.push(e);
  }

  const closedDays = [...liveByDay.keys()].sort();
  const db = createServerClient();
  const { data: existing, error } = await db
    .from("momence_history")
    .select("date, events")
    .in("date", closedDays.length ? closedDays : ["__none__"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const storedByDay = new Map<string, MomenceEvent[]>(
    (existing ?? []).map((r) => [r.date as string, (r.events ?? []) as MomenceEvent[]]),
  );

  const report: { day: string; stored: number; live: number; merged: number; action: string }[] = [];
  const payloads: { date: string; op: "insert" | "update"; events: MomenceEvent[] }[] = [];
  for (const day of closedDays) {
    const live = liveByDay.get(day)!;
    const hasStored = storedByDay.has(day);
    const stored = storedByDay.get(day) ?? [];
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
    today: todayKey,
    diagnostic: {
      totalEvents: events.length,
      span: { min: minDt, max: maxDt },
      apiWindow: { firstDay: allDays[0] ?? null, lastDay: allDays.at(-1) ?? null },
      pastDaysReturned, // días ANTERIORES a hoy que la API aún devuelve
      dayCounts,
    },
    changes: payloads.map((p) => ({ date: p.date, op: p.op, count: p.events.length })),
    report,
    payloads,
  });
}
