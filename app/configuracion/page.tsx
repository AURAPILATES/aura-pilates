import { loadCategories } from "@/lib/categories";
import { loadBusinessEvents } from "@/lib/businessEvents";
import { loadCategoryCounts } from "@/lib/transactions";
import { getContacts, getContactsStats } from "@/app/transacciones/actions";
import ConfiguracionTabs from "./ConfiguracionTabs";
import MobileNav from "@/app/components/MobileNav";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const [categories, events, categoryCounts, contacts, contactStats] = await Promise.all([
    loadCategories(),
    loadBusinessEvents(),
    loadCategoryCounts(),
    getContacts(),
    getContactsStats(),
  ]);

  return (
    <div>
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[45px] flex items-center gap-3">
          <MobileNav />
          <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Configuración</h1>
        </div>
      </div>
      <main className="max-w-[1600px] mx-auto px-6 pt-8 pb-16">
        <ConfiguracionTabs categories={categories} events={events} categoryCounts={categoryCounts} contacts={contacts} contactStats={contactStats} />
      </main>
    </div>
  );
}
