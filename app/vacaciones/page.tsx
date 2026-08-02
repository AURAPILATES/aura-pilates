import { loadPersonas } from "@/lib/vacaciones";
import VacacionesCalendario from "./VacacionesCalendario";
import MobileNav from "@/app/components/MobileNav";

export const dynamic = "force-dynamic";

export default async function VacacionesPage() {
  const { personas, festivos } = await loadPersonas();

  return (
    <div>
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-sm border-b border-navy/[0.06] sm:rounded-t-[14px]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[45px] flex items-center gap-3">
          <MobileNav />
          <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Vacaciones</h1>
        </div>
      </div>
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-6 pb-16 space-y-6">
        <VacacionesCalendario personas={personas} festivos={festivos} />
      </main>
    </div>
  );
}
