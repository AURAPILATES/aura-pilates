"use client";

import { useEffect, useState } from "react";
import type { CustomerRow } from "./ClientesTable";
import ClientesMatrizCompras from "./ClientesMatrizCompras";
import ClientesEstado from "./ClientesEstado";
import SectionTabsV2, { type SectionTabV2 } from "@/app/components/v2/SectionTabsV2";
import type { StripePayment } from "@/lib/stripePayments";
import type { MemberClient } from "@/lib/memberClientsV2";

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
  clients: MemberClient[];
};

type Tab = "clientes" | "compras";

const TABS: SectionTabV2<Tab>[] = [
  { key: "clientes", label: "Clientes" },
  { key: "compras",  label: "Historial de compras" },
];

export default function ClientesShell({ customers, payments, clients }: Props) {
  const [tab, setTab] = useState<Tab>("clientes");
  const [mounted, setMounted] = useState<Record<Tab, boolean>>({ clientes: true, compras: false });

  useEffect(() => { setMounted((m) => ({ ...m, [tab]: true })); }, [tab]);

  return (
    <>
      <SectionTabsV2 className="mb-5" active={tab} onChange={setTab} tabs={TABS} />

      {mounted.clientes && (
        <div className={tab === "clientes" ? "" : "hidden"}>
          <ClientesEstado clients={clients} payments={payments} />
        </div>
      )}
      {mounted.compras && (
        <div className={tab === "compras" ? "" : "hidden"}>
          <ClientesMatrizCompras customers={customers} payments={payments} />
        </div>
      )}
    </>
  );
}
