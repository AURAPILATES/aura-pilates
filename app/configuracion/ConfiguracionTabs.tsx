"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/categories";
import type { BusinessEvent } from "@/lib/businessEvents";
import type { Contact, ContactStats } from "@/app/transacciones/actions";
import SectionTabsV2 from "@/app/components/v2/SectionTabsV2";
import CategoriasManager from "./CategoriasManager";
import ContactosManager from "./ContactosManager";
import HistorialTimeline from "@/app/historial/HistorialTimeline";

type Tab = "categorias" | "contactos" | "historial";

const TABS: { key: Tab; label: string }[] = [
  { key: "categorias", label: "Categorías" },
  { key: "contactos", label: "Contactos" },
  { key: "historial", label: "Historial" },
];

type Props = {
  categories: Category[];
  events: BusinessEvent[];
  categoryCounts: Record<string, number>;
  contacts: Contact[];
  contactStats: Record<number, ContactStats>;
};

export default function ConfiguracionTabs({ categories, events, categoryCounts, contacts, contactStats }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (["contactos", "historial"] as const).find((t) => t === searchParams.get("tab")) ?? "categorias";
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
        <ContactosManager contacts={contacts} categories={categories} contactStats={contactStats} />
      ) : (
        <HistorialTimeline events={events} />
      )}
    </div>
  );
}
