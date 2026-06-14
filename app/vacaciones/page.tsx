import fs from "fs";
import path from "path";
import VacacionesCalendario from "./VacacionesCalendario";

export const dynamic = "force-dynamic";

export default function VacacionesPage() {
  const raw = fs.readFileSync(path.join(process.cwd(), "data/vacaciones.json"), "utf-8");
  const data = JSON.parse(raw);

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Vacaciones</h1>
      <VacacionesCalendario personas={data.personas} festivos={data.festivos} />
    </main>
  );
}
