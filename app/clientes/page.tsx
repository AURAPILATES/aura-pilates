export const dynamic = "force-dynamic";

import { Suspense } from "react";
import ClientesLoader from "./ClientesLoader";
import ClientesSkeleton from "./ClientesSkeleton";
import ClientesGuiaDrawer from "./ClientesGuiaDrawer";
import MobileNav from "@/app/components/MobileNav";
import { pad2 } from "@/lib/periodCalculation";

export default async function ClientesPage() {
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  return (
    <div>
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm sm:rounded-t-[14px]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 flex items-center gap-3">
          <MobileNav />
          <h1 className="text-[26px] font-bold text-navy">Clientes</h1>
          <div className="ml-auto">
            <ClientesGuiaDrawer />
          </div>
        </div>
        <div id="header-tabs" />
      </div>

      <div className="pt-1.5 px-4 sm:px-6 pb-6 max-w-[1600px] mx-auto">
        <Suspense fallback={<ClientesSkeleton />}>
          <ClientesLoader curMonth={curMonth} />
        </Suspense>
      </div>
    </div>
  );
}
