"use client";

import SectionTabsV2 from "@/app/components/v2/SectionTabsV2";
import HeaderPortal from "@/app/components/HeaderPortal";
import { TABS, useAnaliticaTab } from "./AnaliticaTabContext";

export default function AnaliticaTabNav() {
  const { tab, selectTab } = useAnaliticaTab();
  return (
    <HeaderPortal target="header-tabs">
      <SectionTabsV2 active={tab} onChange={selectTab} tabs={TABS} />
    </HeaderPortal>
  );
}
