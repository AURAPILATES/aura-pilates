"use client";

import { useEffect, useState } from "react";
import type { CustomerRow } from "./ClientesTable";
import ClientesMatrizCompras from "./ClientesMatrizCompras";
import ClientesResumenAlumnos from "./ClientesResumenAlumnos";
import ClientesMatrizUrban from "./ClientesMatrizUrban";
import ClientesEstado from "./ClientesEstado";
import ClientesGuiaDrawer from "./ClientesGuiaDrawer";
import ClientesResumenAlumnosGuiaDrawer from "./ClientesResumenAlumnosGuiaDrawer";
import SectionTabsV2, { type SectionTabV2 } from "@/app/components/v2/SectionTabsV2";
import HeaderPortal from "@/app/components/HeaderPortal";
import type { StripePayment } from "@/lib/stripePayments";
import type { MemberClient } from "@/lib/memberClientsV2";
import type { UrbanClientRow } from "@/lib/clientActivityV2";

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
  clients: MemberClient[];
  urbanClients: UrbanClientRow[];
};

type Tab = "clientes" | "compras" | "resumen" | "urban";

const TABS: SectionTabV2<Tab>[] = [
  { key: "clientes", label: "Estado" },
  { key: "compras",  label: "Historial de compras" },
  { key: "resumen",  label: "Resumen alumnos" },
  { key: "urban",    label: "Asistencia Urban" },
];

export default function ClientesShell({ customers, payments, clients, urbanClients }: Props) {
  const [tab, setTab] = useState<Tab>("clientes");
  const [mounted, setMounted] = useState<Record<Tab, boolean>>({ clientes: true, compras: false, resumen: false, urban: false });

  useEffect(() => { setMounted((m) => ({ ...m, [tab]: true })); }, [tab]);

  return (
    <>
      <HeaderPortal target="header-tabs">
        <SectionTabsV2 active={tab} onChange={setTab} tabs={TABS} />
      </HeaderPortal>
      <HeaderPortal target="header-actions">
        {tab === "clientes" && <ClientesGuiaDrawer />}
        {tab === "resumen" && <ClientesResumenAlumnosGuiaDrawer />}
      </HeaderPortal>
      <div className="pt-5" />

      {mounted.clientes && (
        <div className={tab === "clientes" ? "tab-fade-in" : "hidden"}>
          <ClientesEstado clients={clients} payments={payments} />
        </div>
      )}
      {mounted.compras && (
        <div className={tab === "compras" ? "tab-fade-in" : "hidden"}>
          <ClientesMatrizCompras customers={customers} payments={payments} urbanClients={urbanClients} />
        </div>
      )}
      {mounted.resumen && (
        <div className={tab === "resumen" ? "tab-fade-in" : "hidden"}>
          <ClientesResumenAlumnos payments={payments} urbanClients={urbanClients} />
        </div>
      )}
      {mounted.urban && (
        <div className={tab === "urban" ? "tab-fade-in" : "hidden"}>
          <ClientesMatrizUrban rows={urbanClients} clients={clients} payments={payments} />
        </div>
      )}
    </>
  );
}
