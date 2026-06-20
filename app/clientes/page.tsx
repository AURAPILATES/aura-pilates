export const dynamic = "force-dynamic";

import { Suspense } from "react";
import ClientesFilterBar from "./ClientesFilterBar";
import ClientesLoader from "./ClientesLoader";
import ClientesSkeleton from "./ClientesSkeleton";
import MobileNav from "@/app/components/MobileNav";

function pad2(n: number) { return String(n).padStart(2, "0"); }

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

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const periodParam  = typeof sp.period      === "string" ? sp.period      : "30";
  const customFrom   = typeof sp.from        === "string" ? sp.from        : "";
  const customTo     = typeof sp.to          === "string" ? sp.to          : "";
  const compareParam = typeof sp.compareWith === "string" ? sp.compareWith : "previous";
  const cpFrom       = typeof sp.compareFrom === "string" ? sp.compareFrom : "";
  const cpTo         = typeof sp.compareTo   === "string" ? sp.compareTo   : "";

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
    compFrom = addDays(compTo,   -duration);
  }

  const periodLabel =
    periodParam === "7"   ? "7 días"  :
    periodParam === "30"  ? "30 días" :
    periodParam === "90"  ? "90 días" :
    periodParam === "all" ? "Desde el inicio" :
    `${fmtShort(mainFrom)}–${fmtShort(mainTo)}`;

  const compDateRange = `${fmtShort(compFrom)}–${fmtShort(compTo)}`;

  const curMonth  = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const prevMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  })();

  return (
    <div>
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center gap-3">
          <MobileNav />
          <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Clientes</h1>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <ClientesFilterBar />
        <Suspense fallback={<ClientesSkeleton />}>
          <ClientesLoader
            mainFrom={mainFrom}
            mainTo={mainTo}
            compFrom={compFrom}
            compTo={compTo}
            periodLabel={periodLabel}
            compDateRange={compDateRange}
            curMonth={curMonth}
            prevMonth={prevMonth}
          />
        </Suspense>
      </div>
    </div>
  );
}
