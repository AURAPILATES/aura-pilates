import { createServerClient } from "./supabase";
import { MomenceEvent } from "./momence";

const madridDay = (dt: string | Date) =>
  new Date(dt).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

// Guarda el histórico de clases en Supabase, una fila por día. Llamar en cada
// carga de página y desde el cron.
//
// La API pública de Momence solo devuelve clases de HOY en adelante: nunca días
// pasados (el día desaparece al cruzar la medianoche de Madrid). Por eso un día
// solo se puede capturar mientras aún es "hoy", según van terminando sus clases.
//
// La captura es AUTO-SANABLE: la fila de hoy se AMPLÍA (unión por id) en cada
// llamada, nunca encoge. Si una visita temprana solo vio las clases de la mañana,
// una llamada posterior añade las de la tarde. Así se evita el fallo anterior, en
// el que el día se congelaba con la primera captura parcial.
//
// Como la API descarta el día a medianoche, un cron a última hora de la tarde
// (ver vercel.json) garantiza una captura completa antes de que desaparezca.
export async function saveHistoricalEvents(events: MomenceEvent[]) {
  const db = createServerClient();
  const now = new Date();
  const todayKey = madridDay(now);

  // Clases de HOY que ya han empezado (cuentan como impartidas).
  const finishedToday = events.filter(
    (e) =>
      e.published &&
      !e.isCancelled &&
      !e.isDeleted &&
      madridDay(e.dateTime) === todayKey &&
      new Date(e.dateTime) < now,
  );
  if (finishedToday.length === 0) return;

  const { data: rows, error: readError } = await db
    .from("momence_history")
    .select("events")
    .eq("date", todayKey)
    .limit(1);
  if (readError) throw new Error(`saveHistoricalEvents (lectura): ${readError.message}`);
  const existing = rows?.[0];
  const stored = (existing?.events ?? []) as MomenceEvent[];

  // Unión por id; la versión viva manda (ocupación más fresca del día en curso).
  const byId = new Map<number, MomenceEvent>();
  for (const e of stored) byId.set(e.id, e);
  for (const e of finishedToday) byId.set(e.id, e);
  const merged = [...byId.values()].sort(
    (a, b) => +new Date(a.dateTime) - +new Date(b.dateTime),
  );

  if (!existing) {
    const { error } = await db.from("momence_history").insert({ date: todayKey, events: merged });
    if (error) throw new Error(`saveHistoricalEvents (insert): ${error.message}`);
  } else if (merged.length !== stored.length) {
    const { error } = await db
      .from("momence_history")
      .update({ events: merged })
      .eq("date", todayKey);
    if (error) throw new Error(`saveHistoricalEvents (update): ${error.message}`);
  }
}

// Loads all saved historical events from Supabase.
export async function loadHistoricalEvents(): Promise<MomenceEvent[]> {
  const db = createServerClient();
  const { data, error } = await db.from("momence_history").select("events");
  if (error) {
    console.error("loadHistoricalEvents error:", error.message);
    return [];
  }
  return (data ?? []).flatMap((row) => row.events as MomenceEvent[]);
}

// Returns the list of saved dates (YYYY-MM-DD) for display.
export async function savedDates(): Promise<string[]> {
  const db = createServerClient();
  const { data, error } = await db.from("momence_history").select("date").order("date", { ascending: true });
  if (error) {
    console.error("savedDates error:", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.date);
}
