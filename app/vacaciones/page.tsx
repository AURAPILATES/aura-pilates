import { loadPersonas } from "@/lib/vacaciones";
import VacacionesCalendario from "./VacacionesCalendario";

export const dynamic = "force-dynamic";

export default async function VacacionesPage() {
  const { personas, festivos } = await loadPersonas();

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Vacaciones</h1>
      <VacacionesCalendario personas={personas} festivos={festivos} />
    </main>
  );
}
