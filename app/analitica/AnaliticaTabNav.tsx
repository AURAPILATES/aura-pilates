"use client";

import SectionTabs from "@/app/components/SectionTabs";
import { TABS, useAnaliticaTab } from "./AnaliticaTabContext";

export default function AnaliticaTabNav() {
  const { tab, selectTab } = useAnaliticaTab();
  return <SectionTabs className="mb-4" active={tab} onChange={selectTab} tabs={TABS} />;
}
