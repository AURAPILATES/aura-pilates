import { createServerClient } from "./supabase";
import { MomenceEvent } from "./momence";

const madridDay = (dt: string | Date) =>
  new Date(dt).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

// Saves closed days from an API response to Supabase, one row per day.
// Skips days already saved - call this on every page load.
//
// Solo se guardan días YA CERRADOS (anteriores a hoy en Madrid). El día en
// curso nunca se captura: si se congelara a media mañana quedarían fuera las
// clases de la tarde, y como el día ya constaría "guardado" no se volvería a
// tocar, perdiéndose para siempre. El cron de medianoche captura el día
// completo una vez terminado.
export async function saveHistoricalEvents(events: MomenceEvent[]) {
  const db = createServerClient();
  const todayKey = madridDay(new Date());

  const closedDays = events.filter(
    (e) => e.published && !e.isCancelled && !e.isDeleted && madridDay(e.dateTime) < todayKey
  );

  const byDay = new Map<string, MomenceEvent[]>();
  for (const e of closedDays) {
    const key = madridDay(e.dateTime);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  const { data: existing, error: readError } = await db
    .from("momence_history")
    .select("date")
    .in("date", Array.from(byDay.keys()));
  if (readError) throw new Error(`saveHistoricalEvents (lectura): ${readError.message}`);
  const savedDates = new Set((existing ?? []).map((r) => r.date));

  const toInsert = Array.from(byDay.entries())
    .filter(([date]) => !savedDates.has(date))
    .map(([date, dayEvents]) => ({ date, events: dayEvents }));

  if (toInsert.length > 0) {
    const { error } = await db.from("momence_history").insert(toInsert);
    if (error) throw new Error(`saveHistoricalEvents: ${error.message}`);
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
