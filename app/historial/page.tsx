import { loadBusinessEvents } from "@/lib/businessEvents";
import HistorialTimeline from "./HistorialTimeline";

export const dynamic = "force-dynamic";

export default async function HistorialPage() {
  const events = await loadBusinessEvents();

  return (
    <div>
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-[45px] flex items-center">
          <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Historial</h1>
        </div>
      </div>
      <main className="max-w-3xl mx-auto px-6 pt-8 pb-16">
        <HistorialTimeline events={events} />
      </main>
    </div>
  );
}
