export const dynamic = "force-dynamic";

import { Suspense } from "react";
import HorarioLoader from "./HorarioLoader";
import HorarioSkeleton from "./HorarioSkeleton";

function getMondayFromParam(week: string | null): string {
  if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) return week;
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function Horario({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string }>;
}) {
  const params = await searchParams;
  const weekMonday = getMondayFromParam(params.week ?? null);
  const initialView = params.view === "lista" ? "lista" : "calendario";

  return (
    <Suspense fallback={<HorarioSkeleton />}>
      <HorarioLoader
        weekMonday={weekMonday}
        initialView={initialView as "lista" | "calendario"}
      />
    </Suspense>
  );
}
