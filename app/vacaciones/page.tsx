import data from "@/data/vacaciones.json";
import VacacionesCalendario from "./VacacionesCalendario";

export default function VacacionesPage() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Vacaciones</h1>
      <VacacionesCalendario personas={data.personas} festivos={data.festivos} />
    </main>
  );
}
