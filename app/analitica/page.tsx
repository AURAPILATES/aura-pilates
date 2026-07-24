export const dynamic = "force-dynamic";

import { Suspense } from "react";
import AnaliticaFilterBar from "./AnaliticaFilterBar";
import AnaliticaLoader from "./AnaliticaLoader";
import AnaliticaSkeleton from "./AnaliticaSkeleton";
import AnaliticaTabNav from "./AnaliticaTabNav";
import { AnaliticaTabProvider } from "./AnaliticaTabContext";
import MobileNav from "@/app/components/MobileNav";
import { resolveCalendarPeriod } from "@/lib/periodCalculation";

export default async function Analitica(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;

  const { from: mainFrom, to: mainTo, compFrom, compTo, periodLabel, compDateRange } = resolveCalendarPeriod(sp);

  return (
    <div>
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[45px] flex items-center gap-3">
          <MobileNav />
          <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Analítica</h1>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-6 pb-16">
        <Suspense fallback={<AnaliticaSkeleton />}>
          <AnaliticaTabProvider>
            <AnaliticaTabNav />

            <Suspense fallback={<div className="h-10 mb-4" />}>
              <AnaliticaFilterBar />
            </Suspense>

            <Suspense fallback={<AnaliticaSkeleton />}>
              <AnaliticaLoader
                mainFrom={mainFrom}
                mainTo={mainTo}
                compFrom={compFrom}
                compTo={compTo}
                periodLabel={periodLabel}
                compDateRange={compDateRange}
              />
            </Suspense>
          </AnaliticaTabProvider>
        </Suspense>
      </div>
    </div>
  );
}
