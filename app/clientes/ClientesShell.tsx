"use client";

import { useEffect, useState, useRef } from "react";
import ClientesTable, { type ClientesTableHandle, type CustomerRow } from "./ClientesTable";
import ClientesMatrizCompras from "./ClientesMatrizCompras";
import ClientesGuiaDrawer from "./ClientesGuiaDrawer";
import SectionTabsV2, { type SectionTabV2 } from "@/app/components/v2/SectionTabsV2";
import type { StripePayment } from "@/lib/stripePayments";

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
};

type Tab = "estado" | "compras";

const TABS: SectionTabV2<Tab>[] = [
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
      <div className="flex items-stretch gap-3 mb-5">
        <div className="flex-1 min-w-0">
          <SectionTabsV2 active={tab} onChange={setTab} tabs={TABS} />
        </div>
        <div className="shrink-0 flex items-end pb-[7px]">
          <ClientesGuiaDrawer />
        </div>
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
