"use client";

import SectionTabsV2 from "@/app/components/v2/SectionTabsV2";
import { TABS, useAnaliticaTab } from "./AnaliticaTabContext";

export default function AnaliticaTabNav() {
  const { tab, selectTab } = useAnaliticaTab();
  return <SectionTabsV2 className="mb-4" active={tab} onChange={selectTab} tabs={TABS} />;
}
