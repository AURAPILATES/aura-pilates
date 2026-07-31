"use client";

import { useEffect, useState } from "react";
import type { CustomerRow } from "./ClientesTable";
import ClientesMatrizCompras from "./ClientesMatrizCompras";
import ClientesActividad from "./ClientesActividad";
import ClientesEstado from "./ClientesEstado";
import SectionTabsV2, { type SectionTabV2 } from "@/app/components/v2/SectionTabsV2";
import type { StripePayment } from "@/lib/stripePayments";
import type { ClientActivityV2 } from "@/lib/clientActivityV2";
import type { MemberClient } from "@/lib/memberClientsV2";

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
  activity: ClientActivityV2 | null;
  clients: MemberClient[];
};

type Tab = "estado" | "compras" | "actividad";

const TABS: SectionTabV2<Tab>[] = [
  { key: "estado",    label: "Estado de clientes" },
  { key: "compras",   label: "Historial de compras" },
  { key: "actividad", label: "Actividad de clases" },
];

export default function ClientesShell({ customers, payments, activity, clients }: Props) {
  const [tab, setTab] = useState<Tab>("estado");
  const [mounted, setMounted] = useState<Record<Tab, boolean>>({ estado: true, compras: false, actividad: false });

  useEffect(() => { setMounted((m) => ({ ...m, [tab]: true })); }, [tab]);

  return (
    <>
      <SectionTabsV2 className="mb-5" active={tab} onChange={setTab} tabs={TABS} />

      {mounted.estado && (
        <div className={tab === "estado" ? "" : "hidden"}>
          <ClientesEstado clients={clients} payments={payments} />
        </div>
      )}
      {mounted.compras && (
        <div className={tab === "compras" ? "" : "hidden"}>
          <ClientesMatrizCompras customers={customers} payments={payments} />
        </div>
      )}
      {mounted.actividad && (
        <div className={tab === "actividad" ? "" : "hidden"}>
          <ClientesActividad data={activity} />
        </div>
      )}
    </>
  );
}
