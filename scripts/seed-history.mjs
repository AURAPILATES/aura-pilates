import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data", "history");
mkdirSync(DATA_DIR, { recursive: true });

// Hour in Madrid (CEST = UTC+2) → UTC hour
const toUTC = (h) => h - 2;

// Historical data from Momence dashboard screenshot
// Format: { date: "YYYY-MM-DD", slots: { madridHour: ticketsSold } }
const historicalData = [
  { date: "2026-05-04", slots: { 17: 4, 18: 4, 19: 4, 20: 1 } },
  { date: "2026-05-05", slots: { 8: 5, 9: 4, 10: 5, 11: 4, 17: 2, 18: 3, 19: 5, 20: 5 } },
  { date: "2026-05-06", slots: { 17: 3, 18: 4, 19: 5, 20: 4 } },
  { date: "2026-05-07", slots: { 8: 5, 9: 5, 10: 4, 11: 3, 17: 2, 18: 4, 19: 5, 20: 2 } },
  { date: "2026-05-08", slots: { 8: 2, 9: 4, 10: 1, 11: 3, 17: 3, 18: 5, 19: 4, 20: 2 } },
  { date: "2026-05-11", slots: { 17: 4, 18: 4, 19: 5, 20: 3 } },
  { date: "2026-05-12", slots: { 8: 4, 9: 5, 10: 4, 11: 5, 17: 3, 18: 4, 19: 5, 20: 5 } },
  { date: "2026-05-13", slots: { 17: 4, 18: 3, 19: 5, 20: 3 } },
  { date: "2026-05-14", slots: { 8: 4, 9: 3, 10: 3, 11: 4, 17: 3, 18: 3, 19: 4, 20: 3 } },
  { date: "2026-05-15", slots: { 8: 4, 9: 3, 10: 1, 11: 3, 17: 2, 18: 5, 19: 4, 20: 3 } },
  { date: "2026-05-18", slots: { 17: 2, 18: 2, 19: 5, 20: 3 } },
  { date: "2026-05-19", slots: { 8: 3, 9: 5, 10: 5, 11: 4, 17: 5, 18: 4, 19: 5, 20: 3 } },
  { date: "2026-05-20", slots: { 17: 2, 18: 3, 19: 5, 20: 4 } },
  { date: "2026-05-21", slots: { 17: 4, 18: 5, 19: 5, 20: 3 } },
  { date: "2026-05-22", slots: { 8: 2, 9: 4, 10: 4, 11: 3, 17: 3, 18: 5, 19: 0, 20: 2 } },
  { date: "2026-05-26", slots: { 8: 5, 9: 3, 10: 5, 11: 4, 17: 4, 18: 5, 19: 5, 20: 5 } },
  { date: "2026-05-27", slots: { 17: 5, 18: 2, 19: 5, 20: 5 } },
  { date: "2026-05-28", slots: { 8: 4, 9: 5, 10: 3, 11: 4, 17: 5, 18: 5, 19: 3, 20: 4 } },
  { date: "2026-05-29", slots: { 8: 5, 9: 2, 10: 1, 11: 3, 17: 2, 18: 5, 19: 2, 20: 4 } },
  { date: "2026-06-01", slots: { 17: 3, 18: 4, 19: 5, 20: 4 } },
  { date: "2026-06-02", slots: { 8: 5, 9: 1, 10: 5, 11: 2, 17: 1, 18: 5, 19: 5, 20: 5 } },
  { date: "2026-06-03", slots: { 17: 1, 18: 5, 19: 4, 20: 5 } },
  { date: "2026-06-04", slots: { 8: 3, 9: 5, 10: 5, 11: 5, 17: 1, 18: 4, 19: 5, 20: 5 } },
  { date: "2026-06-05", slots: { 8: 5, 9: 5, 10: 4, 11: 2, 17: 3, 18: 5, 19: 1, 20: 5 } },
  { date: "2026-06-08", slots: { 17: 5, 18: 3, 19: 5, 20: 5 } },
  { date: "2026-06-09", slots: { 8: 2, 9: 5, 10: 5, 11: 5, 17: 1, 18: 3, 19: 5, 20: 5 } },
  { date: "2026-06-10", slots: { 17: 3, 18: 2, 19: 5, 20: 5 } },
  { date: "2026-06-11", slots: { 8: 5, 9: 5, 10: 5, 11: 3, 17: 4, 18: 2, 19: 5, 20: 3 } },
  { date: "2026-06-12", slots: { 8: 0, 9: 1, 10: 2, 11: 2, 17: 5, 18: 5, 19: 2, 20: 4 } },
];

let idCounter = 800000000;
let totalFiles = 0;

for (const { date, slots } of historicalData) {
  const events = [];
  for (const [hourStr, ticketsSold] of Object.entries(slots)) {
    const madridHour = parseInt(hourStr);
    const utcHour = toUTC(madridHour);
    const dateTime = `${date}T${String(utcHour).padStart(2, "0")}:00:00.000Z`;
    events.push({
      id: idCounter++,
      title: "Pilates Reformer",
      description: "",
      type: "Regular",
      link: "https://momence.com/s/159600",
      dateTime,
      image1: null,
      image2: null,
      duration: 55,
      fixedPrice: 20,
      online: false,
      location: "Aura Pilates Studio",
      isCancelled: false,
      isDeleted: false,
      allowWaitlist: true,
      capacity: 5,
      spotsRemaining: Math.max(0, 5 - ticketsSold),
      ticketsSold,
      tags: [],
      hostId: 159600,
      published: true,
      teacherId: 0,
      teacher: "",
      additionalTeachers: [],
    });
  }

  const file = path.join(DATA_DIR, `${date}.json`);
  writeFileSync(file, JSON.stringify(events, null, 2));
  totalFiles++;
  console.log(`${date}: ${events.length} clases, ${events.reduce((s, e) => s + e.ticketsSold, 0)} alumnos`);
}

console.log(`\nListo. ${totalFiles} días guardados en data/history/`);
