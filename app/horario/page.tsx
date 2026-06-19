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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to + "T12:00:00").getTime() - new Date(from + "T12:00:00").getTime()) / 86400000,
  );
}

function fmtShort(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

export default async function Horario({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; view?: string; tab?: string; period?: string; from?: string; to?: string; compareWith?: string; compareFrom?: string; compareTo?: string }>;
}) {
  const params = await searchParams;
  const weekMonday = getMondayFromParam(params.week ?? null);

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const periodParam  = typeof params.period      === "string" ? params.period      : "30";
  const customFrom   = typeof params.from        === "string" ? params.from        : "";
  const customTo     = typeof params.to          === "string" ? params.to          : "";
  const compareParam = typeof params.compareWith === "string" ? params.compareWith : "previous";
  const cpFrom       = typeof params.compareFrom === "string" ? params.compareFrom : "";
  const cpTo         = typeof params.compareTo   === "string" ? params.compareTo   : "";

  let mainFrom: string;
  let mainTo: string = todayStr;
  if (periodParam === "custom" && customFrom && customTo) {
    mainFrom = customFrom;
    mainTo   = customTo;
  } else if (periodParam === "all") {
    mainFrom = "2026-02-01";
  } else {
    const days = periodParam === "7" ? 7 : periodParam === "90" ? 90 : 30;
    mainFrom = addDays(todayStr, -days);
  }

  let compFrom: string;
  let compTo: string;
  if (compareParam === "custom" && cpFrom && cpTo) {
    compFrom = cpFrom;
    compTo   = cpTo;
  } else {
    const duration = daysBetween(mainFrom, mainTo);
    compTo   = addDays(mainFrom, -1);
    compFrom = addDays(compTo, -duration);
  }

  const periodLabel =
    periodParam === "7"   ? "7 días"  :
    periodParam === "30"  ? "30 días" :
    periodParam === "90"  ? "90 días" :
    periodParam === "all" ? "Desde el inicio" :
    `${fmtShort(mainFrom)}–${fmtShort(mainTo)}`;

  const initialView = params.view === "calendario" ? "calendario" : "lista";
  const initialTab  = params.tab === "analisis" ? "analisis" : "horario";

  return (
    <Suspense fallback={<HorarioSkeleton />}>
      <HorarioLoader
        weekMonday={weekMonday}
        initialView={initialView as "lista" | "calendario"}
        initialTab={initialTab as "horario" | "analisis"}
        mainFrom={mainFrom}
        mainTo={mainTo}
        compFrom={compFrom}
        compTo={compTo}
        periodLabel={periodLabel}
      />
    </Suspense>
  );
}
