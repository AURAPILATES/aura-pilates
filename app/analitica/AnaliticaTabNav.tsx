"use client";

import SectionTabs from "@/app/components/SectionTabs";
import SectionTabsV2 from "@/app/components/v2/SectionTabsV2";
import { useDesignVersion } from "@/app/components/DesignVersionContext";
import { TABS, useAnaliticaTab } from "./AnaliticaTabContext";

export default function AnaliticaTabNav() {
  const { tab, selectTab } = useAnaliticaTab();
  const { v2 } = useDesignVersion();
  return v2
    ? <SectionTabsV2 className="mb-4" active={tab} onChange={selectTab} tabs={TABS} />
    : <SectionTabs className="mb-4" active={tab} onChange={selectTab} tabs={TABS} />;
}
