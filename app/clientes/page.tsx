export const dynamic = "force-dynamic";

import { Suspense } from "react";
import ClientesFilterBar from "./ClientesFilterBar";
import ClientesLoader from "./ClientesLoader";
import ClientesSkeleton from "./ClientesSkeleton";
import MobileNav from "@/app/components/MobileNav";
import { resolvePeriod, pad2 } from "@/lib/periodCalculation";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const now = new Date();

  const { from: mainFrom, to: mainTo, compFrom, compTo, periodLabel, compDateRange } = resolvePeriod(sp);

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
