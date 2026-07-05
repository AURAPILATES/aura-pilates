"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type Tab = "caja" | "gastos" | "ingresos" | "clientes" | "fiscal" | "ocupacion";

export const TABS: { key: Tab; label: string }[] = [
  { key: "caja", label: "Caja y resultado" },
  { key: "gastos", label: "Gastos" },
  { key: "ingresos", label: "Ingresos" },
  { key: "clientes", label: "Clientes" },
  { key: "fiscal", label: "Fiscal y financiación" },
  { key: "ocupacion", label: "Ocupación" },
];

const AnaliticaTabContext = createContext<{ tab: Tab; selectTab: (next: Tab) => void } | null>(null);

/** Vive por encima de la tab nav y del loader async para que ambos compartan el mismo
 * estado de pestaña activa, aunque la nav se renderice antes de que el loader resuelva. */
export function AnaliticaTabProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = TABS.find((t) => t.key === searchParams.get("tab"))?.key ?? "caja";
  const [tab, setTab] = useState<Tab>(initialTab);

  function selectTab(next: Tab) {
    setTab(next);
    router.replace(next === "caja" ? "/analitica" : `/analitica?tab=${next}`, { scroll: false });
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
