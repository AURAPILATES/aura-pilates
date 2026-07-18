"use client";

import SectionTabs from "@/app/components/SectionTabs";
import SectionTabsV2 from "@/app/components/v2/SectionTabsV2";
import { TABS, useAnaliticaTab } from "./AnaliticaTabContext";

export default function AnaliticaTabNav() {
  const { tab, selectTab } = useAnaliticaTab();
  return (
    <>
      <div className="hidden sm:block">
        <SectionTabsV2 className="mb-4" active={tab} onChange={selectTab} tabs={TABS} />
      </div>
      <div className="sm:hidden">
        <SectionTabs className="mb-4" active={tab} onChange={selectTab} tabs={TABS} />
      </div>
    </>
  );
}
