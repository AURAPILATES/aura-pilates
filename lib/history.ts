import { promises as fs } from "fs";
import path from "path";
import { MomenceEvent } from "./momence";

const DATA_DIR = path.join(process.cwd(), "data", "history");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

// Saves past events from an API response to daily JSON files.
// Skips days already saved — call this on every page load.
export async function saveHistoricalEvents(events: MomenceEvent[]) {
  await ensureDataDir();
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

  for (const [date, dayEvents] of byDay.entries()) {
    const file = path.join(DATA_DIR, `${date}.json`);
    try {
      await fs.access(file);
      // already saved, skip
    } catch {
      await fs.writeFile(file, JSON.stringify(dayEvents, null, 2), "utf-8");
    }
  }
}

// Loads all saved historical events from local JSON files.
export async function loadHistoricalEvents(): Promise<MomenceEvent[]> {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  const events: MomenceEvent[] = [];

  for (const file of files.filter((f) => f.endsWith(".json"))) {
    const content = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
    const parsed: MomenceEvent[] = JSON.parse(content);
    events.push(...parsed);
  }

  return events;
}

// Returns the list of saved dates (YYYY-MM-DD) for display.
export async function savedDates(): Promise<string[]> {
  await ensureDataDir();
  const files = await fs.readdir(DATA_DIR);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort();
}
