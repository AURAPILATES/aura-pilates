"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/categories";
import type { BusinessEvent } from "@/lib/businessEvents";
import CategoriasManager from "./CategoriasManager";
import HistorialTimeline from "@/app/historial/HistorialTimeline";

type Tab = "categorias" | "historial";

const TABS: { key: Tab; label: string }[] = [
  { key: "categorias", label: "Categorías" },
  { key: "historial", label: "Historial" },
];

type Props = {
  categories: Category[];
  events: BusinessEvent[];
};

export default function ConfiguracionTabs({ categories, events }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "historial" ? "historial" : "categorias");

  function selectTab(next: Tab) {
    setTab(next);
    router.replace(next === "categorias" ? "/configuracion" : "/configuracion?tab=historial", { scroll: false });
  }

  return (
    <div>
      <div className="flex items-center gap-1 border-b border-navy/[0.08] mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-navy/50 hover:text-navy"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "categorias" ? (
        <CategoriasManager categories={categories} />
      ) : (
        <HistorialTimeline events={events} />
      )}
    </div>
  );
}
