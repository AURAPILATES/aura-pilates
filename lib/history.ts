import { createServerClient } from "./supabase";
import { MomenceEvent } from "./momence";

// Saves past events from an API response to Supabase, one row per day.
// Skips days already saved — call this on every page load.
export async function saveHistoricalEvents(events: MomenceEvent[]) {
  const db = createServerClient();
  const now = new Date();

  const past = events.filter(
    (e) => new Date(e.dateTime) < now && e.published && !e.isCancelled && !e.isDeleted
  );

  const byDay = new Map<string, MomenceEvent[]>();
  for (const e of past) {
    const key = new Date(e.dateTime).toLocaleDateString("sv-SE", {
      timeZone: "Europe/Madrid",
    });
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
