export const dynamic = "force-dynamic";

import { Suspense } from "react";
import ClientesFilterBar from "@/app/clientes/ClientesFilterBar";
import FinanzasLoader from "./FinanzasLoader";
import FinanzasSkeleton from "./FinanzasSkeleton";
import MobileNav from "@/app/components/MobileNav";
import { resolvePeriod } from "@/lib/periodCalculation";

export default async function Finanzas(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;

  const { from: mainFrom, to: mainTo, compFrom, compTo, periodLabel, compDateRange } = resolvePeriod(sp);

  return (
    <div>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center gap-3">
          <MobileNav />
          <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Finanzas</h1>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <Suspense fallback={<div className="h-10 mb-4" />}>
          <ClientesFilterBar />
        </Suspense>

        <Suspense fallback={<FinanzasSkeleton />}>
          <FinanzasLoader
            mainFrom={mainFrom}
            mainTo={mainTo}
            compFrom={compFrom}
            compTo={compTo}
            periodLabel={periodLabel}
            compDateRange={compDateRange}
          />
        </Suspense>
      </div>
    </div>
  );
}
