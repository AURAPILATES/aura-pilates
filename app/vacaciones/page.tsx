import { loadPersonas } from "@/lib/vacaciones";
import VacacionesCalendario from "./VacacionesCalendario";
import MobileNav from "@/app/components/MobileNav";

export const dynamic = "force-dynamic";

export default async function VacacionesPage() {
  const { personas, festivos } = await loadPersonas();

  return (
    <div>
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm sm:rounded-t-[14px]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MobileNav />
            <h1 className="text-[26px] font-bold text-navy">Vacaciones</h1>
          </div>
          <div id="header-actions" className="flex items-center gap-2 shrink-0" />
        </div>
      </div>
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-1.5 pb-16 space-y-6">
        <VacacionesCalendario personas={personas} festivos={festivos} />
      </main>
    </div>
  );
}
