export const dynamic = "force-dynamic";

import { getEvents } from "@/lib/momence";
import { filterActive } from "@/lib/analytics";
import HorarioShell from "./HorarioShell";

function getMondayFromParam(week: string | null): Date {
  if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
    const d = new Date(week + "T00:00:00");
    if (!isNaN(d.getTime())) return d;
  }
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // 0 = Monday
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
}

export default async function Horario({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string }>;
}) {
  const params = await searchParams;
  const monday = getMondayFromParam(params.week ?? null);
  const sunday = new Date(monday.getTime() + 7 * 86400000 - 1);

  const allEvents = await getEvents();
  const active = filterActive(allEvents);
  const weekEvents = active.filter((e) => {
    const d = new Date(e.dateTime);
    return d >= monday && d <= sunday;
  });

  const weekMonday = monday.toISOString().split("T")[0];
  const initialView = params.view === "calendario" ? "calendario" : "lista";

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <HorarioShell
        events={weekEvents}
        weekMonday={weekMonday}
        initialView={initialView as "lista" | "calendario"}
      />
    </main>
  );
}
