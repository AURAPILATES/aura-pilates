"use client";

import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SectionTabs from "@/app/components/SectionTabs";

type Tab = "caja" | "gastos" | "ingresos" | "clientes" | "fiscal";

const TABS: { key: Tab; label: string }[] = [
  { key: "caja", label: "Caja y resultado" },
  { key: "gastos", label: "Gastos" },
  { key: "ingresos", label: "Ingresos" },
  { key: "clientes", label: "Clientes" },
  { key: "fiscal", label: "Fiscal y financiación" },
];

type Props = Record<Tab, ReactNode>;

export default function AnaliticaTabs({ caja, gastos, ingresos, clientes, fiscal }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = TABS.find((t) => t.key === searchParams.get("tab"))?.key ?? "caja";
  const [tab, setTab] = useState<Tab>(initialTab);

  function selectTab(next: Tab) {
    setTab(next);
    router.replace(next === "caja" ? "/analitica" : `/analitica?tab=${next}`, { scroll: false });
  }

  const content: Props = { caja, gastos, ingresos, clientes, fiscal };

  return (
    <div>
      <SectionTabs className="mb-7" active={tab} onChange={selectTab} tabs={TABS} />
      {content[tab]}
    </div>
  );
}
