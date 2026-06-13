import data from "@/data/vacaciones.json";
import VacacionesCalendario from "./VacacionesCalendario";

export default function VacacionesPage() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      <VacacionesCalendario personas={data.personas} festivos={data.festivos} />
    </main>
  );
}
