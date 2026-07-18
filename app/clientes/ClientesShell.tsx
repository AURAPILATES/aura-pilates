"use client";

import { useEffect, useState, useRef } from "react";
import ClientesTable, { type ClientesTableHandle, type CustomerRow } from "./ClientesTable";
import ClientesMatrizCompras from "./ClientesMatrizCompras";
import SectionTabs, { type SectionTab } from "@/app/components/SectionTabs";
import SectionTabsV2 from "@/app/components/v2/SectionTabsV2";
import type { StripePayment } from "@/lib/stripePayments";

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
};

type Tab = "estado" | "compras";

const TABS: SectionTab<Tab>[] = [
  { key: "estado",  label: "Estado de clientes" },
  { key: "compras", label: "Historial de compras" },
];

export default function ClientesShell({ customers, payments }: Props) {
  const [tab, setTab] = useState<Tab>("estado");
  const [mounted, setMounted] = useState<Record<Tab, boolean>>({ estado: true, compras: false });
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const tableRef = useRef<ClientesTableHandle>(null);

  useEffect(() => { setMounted((m) => ({ ...m, [tab]: true })); }, [tab]);

  return (
    <>
      <div className="hidden sm:block">
        <SectionTabsV2 className="mb-5" active={tab} onChange={setTab} tabs={TABS} />
      </div>
      <div className="sm:hidden">
        <SectionTabs className="mb-5" active={tab} onChange={setTab} tabs={TABS} />
      </div>

      {mounted.estado && (
        <div className={tab === "estado" ? "" : "hidden"}>
          <ClientesTable
            ref={tableRef}
            customers={customers}
            payments={payments}
            activeMonth={activeMonth}
            onClearMonth={() => setActiveMonth(null)}
          />
        </div>
      )}
      {mounted.compras && (
        <div className={tab === "compras" ? "" : "hidden"}>
          <ClientesMatrizCompras
            customers={customers}
            payments={payments}
          />
        </div>
      )}
    </>
  );
}
