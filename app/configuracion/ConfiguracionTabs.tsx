"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/categories";
import type { BusinessEvent } from "@/lib/businessEvents";
import type { Contact, ContactStats } from "@/app/transacciones/actions";
import type { PricingRow } from "@/lib/stripePayments";
import type { UrbanRate } from "@/lib/urbanRates";
import SectionTabsV2 from "@/app/components/v2/SectionTabsV2";
import CategoriasManager from "./CategoriasManager";
import ContactosManager from "./ContactosManager";
import HistorialTimeline from "@/app/historial/HistorialTimeline";
import PreciosViewer from "./PreciosViewer";
import TarifaUrbanManager from "./TarifaUrbanManager";

type Tab = "categorias" | "contactos" | "historial" | "precios";

const TABS: { key: Tab; label: string }[] = [
  { key: "categorias", label: "Categorías" },
  { key: "contactos", label: "Contactos" },
  { key: "historial", label: "Historial" },
  { key: "precios", label: "Precios" },
];

type Props = {
  categories: Category[];
  events: BusinessEvent[];
  categoryCounts: Record<string, number>;
  contacts: Contact[];
  contactStats: Record<number, ContactStats>;
  pendingRecomputeCount: number;
  pendingCleanupCount: number;
  pricingRows: PricingRow[];
  dismissedDuplicates: string[];
  urbanRates: UrbanRate[];
};

export default function ConfiguracionTabs({ categories, events, categoryCounts, contacts, contactStats, pendingRecomputeCount, pendingCleanupCount, pricingRows, dismissedDuplicates, urbanRates }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (["contactos", "historial", "precios"] as const).find((t) => t === searchParams.get("tab")) ?? "categorias";
  const [tab, setTab] = useState<Tab>(initialTab);

  function selectTab(next: Tab) {
    setTab(next);
    router.replace(next === "categorias" ? "/configuracion" : `/configuracion?tab=${next}`, { scroll: false });
  }

  return (
    <div>
      <SectionTabsV2 className="mb-6" active={tab} onChange={selectTab} tabs={TABS} />
      {tab === "categorias" ? (
        <CategoriasManager categories={categories} categoryCounts={categoryCounts} />
      ) : tab === "contactos" ? (
        <ContactosManager
          contacts={contacts}
          categories={categories}
          contactStats={contactStats}
          pendingRecomputeCount={pendingRecomputeCount}
          pendingCleanupCount={pendingCleanupCount}
          dismissedDuplicates={dismissedDuplicates}
        />
      ) : tab === "precios" ? (
        <>
          <TarifaUrbanManager rates={urbanRates} />
          <PreciosViewer rows={pricingRows} />
        </>
      ) : (
        <HistorialTimeline events={events} />
      )}
    </div>
  );
}
