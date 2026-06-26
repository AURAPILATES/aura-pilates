"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/categories";
import type { BusinessEvent } from "@/lib/businessEvents";
import type { Contact, ContactStats } from "@/app/transacciones/actions";
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
      <div className="flex items-center gap-6 border-b border-navy/[0.08] mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={`py-2.5 text-sm font-semibold transition-colors ${
              tab === key ? "text-navy" : "text-navy/50 hover:text-navy"
            }`}
          >
            <span className={`pb-2.5 border-b-2 -mb-px ${tab === key ? "border-navy" : "border-transparent"}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
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
