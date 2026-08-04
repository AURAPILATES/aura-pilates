export const dynamic = "force-dynamic";

import { Suspense } from "react";
import PrevisionesLoader from "./PrevisionesLoader";
import PrevisionesSkeleton from "./PrevisionesSkeleton";
import MobileNav from "@/app/components/MobileNav";

export default function PrevisionesPage() {
  return (
    <div>
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm sm:rounded-t-[14px]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <MobileNav />
          <h1 className="text-[26px] font-bold text-navy">Previsiones</h1>
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-1.5 pb-16 max-w-[1600px] mx-auto">
        <Suspense fallback={<PrevisionesSkeleton />}>
          <PrevisionesLoader />
        </Suspense>
      </div>
    </div>
  );
}
