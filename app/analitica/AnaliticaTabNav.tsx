"use client";

import SectionTabs from "@/app/components/SectionTabs";
import SectionTabsV2 from "@/app/components/v2/SectionTabsV2";
import { useDesignVersion } from "@/app/components/DesignVersionContext";
import { TABS, useAnaliticaTab } from "./AnaliticaTabContext";

export default function AnaliticaTabNav() {
  const { tab, selectTab } = useAnaliticaTab();
  const { v2 } = useDesignVersion();
  return (
    <>
      {v2 && (
        <div className="hidden sm:block">
          <SectionTabsV2 className="mb-4" active={tab} onChange={selectTab} tabs={TABS} />
        </div>
      )}
      <div className={v2 ? "sm:hidden" : ""}>
        <SectionTabs className="mb-4" active={tab} onChange={selectTab} tabs={TABS} />
      </div>
    </>
  );
}
