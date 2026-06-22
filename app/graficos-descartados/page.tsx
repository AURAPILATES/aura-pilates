export const dynamic = "force-dynamic";

import { Suspense } from "react";
import GraficosDescartadosLoader from "./GraficosDescartadosLoader";
import MobileNav from "@/app/components/MobileNav";
import { resolvePeriod } from "@/lib/periodCalculation";

export default async function GraficosDescartadosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const { from, to, periodLabel } = resolvePeriod(params);

  return (
    <div>
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center gap-3">
          <MobileNav />
          <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Gráficos descartados</h1>
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-6 pb-16 max-w-6xl mx-auto">
        <p className="text-sm text-navy/45 mb-6">
          Gráficos retirados de Horario · Análisis. Se mantienen aquí por si hace falta consultarlos.
        </p>
        <Suspense fallback={<p className="text-sm text-navy/45">Cargando…</p>}>
          <GraficosDescartadosLoader from={from} to={to} periodLabel={periodLabel} />
        </Suspense>
      </div>
    </div>
  );
}
