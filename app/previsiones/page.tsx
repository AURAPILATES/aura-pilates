export const dynamic = "force-dynamic";

import { Suspense } from "react";
import PrevisionesLoader from "./PrevisionesLoader";
import PrevisionesSkeleton from "./PrevisionesSkeleton";

export default function PrevisionesPage() {
  return (
    <div>
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center">
          <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Previsiones</h1>
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-6 pb-16 max-w-6xl mx-auto">
        <Suspense fallback={<PrevisionesSkeleton />}>
          <PrevisionesLoader />
        </Suspense>
      </div>
    </div>
  );
}
