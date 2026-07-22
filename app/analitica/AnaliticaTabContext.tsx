"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type Tab = "ingresosGastos" | "clientes";

export const TABS: { key: Tab; label: string }[] = [
  { key: "ingresosGastos", label: "Ingresos y gastos" },
  { key: "clientes", label: "Clientes" },
];

const AnaliticaTabContext = createContext<{ tab: Tab; selectTab: (next: Tab) => void } | null>(null);

/** Vive por encima de la tab nav y del loader async para que ambos compartan el mismo
 * estado de pestaña activa, aunque la nav se renderice antes de que el loader resuelva. */
export function AnaliticaTabProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = TABS.find((t) => t.key === searchParams.get("tab"))?.key ?? "ingresosGastos";
  const [tab, setTab] = useState<Tab>(initialTab);

  function selectTab(next: Tab) {
    setTab(next);
    router.replace(next === "ingresosGastos" ? "/analitica" : `/analitica?tab=${next}`, { scroll: false });
  }

  return (
    <AnaliticaTabContext.Provider value={{ tab, selectTab }}>
      {children}
    </AnaliticaTabContext.Provider>
  );
}

export function useAnaliticaTab() {
  const ctx = useContext(AnaliticaTabContext);
  if (!ctx) throw new Error("useAnaliticaTab debe usarse dentro de AnaliticaTabProvider");
  return ctx;
}
