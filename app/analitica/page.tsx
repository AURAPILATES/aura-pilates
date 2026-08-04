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
  const activeTab = sp.tab === "clientes" ? "clientes" : "ingresosGastos";

  return (
    <div>
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm sm:rounded-t-[14px]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <MobileNav />
          <h1 className="text-[26px] font-bold text-navy">Analítica</h1>
        </div>
        <div id="header-tabs" />
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-1.5 pb-16">
        <Suspense fallback={<AnaliticaSkeleton tab={activeTab} />}>
          <AnaliticaTabProvider>
            <AnaliticaTabNav />

            <div className="pt-4">
              <Suspense fallback={<div className="h-10" />}>
                <AnaliticaFilterBar />
              </Suspense>
            </div>

            <Suspense fallback={<AnaliticaSkeleton tab={activeTab} />}>
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
