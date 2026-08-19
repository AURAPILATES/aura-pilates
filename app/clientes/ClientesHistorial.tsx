"use client";

import { useState } from "react";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import ClientesMatrizCompras from "./ClientesMatrizCompras";
import ClientesMatrizUrban from "./ClientesMatrizUrban";
import type { CustomerRow } from "./ClientesTable";
import type { StripePayment } from "@/lib/stripePayments";
import type { MemberClient } from "@/lib/memberClientsV2";
import type { UrbanClientRow } from "@/lib/clientActivityV2";

type Source = "momence" | "urban";

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
  clients: MemberClient[];
  urbanClients: UrbanClientRow[];
};

/** Historial de compras, con la procedencia (Momence o Urban) elegible por toggle en vez de
 * ser dos pestañas separadas - son matrices mes a mes por cliente muy parecidas, pero cada
 * una con su propia ficha (CustomerDrawer vs MemberDrawer) y columnas (importe vs clases), así
 * que se mantienen como componentes separados y aquí solo se decide cuál mostrar. */
export default function ClientesHistorial({ customers, payments, clients, urbanClients }: Props) {
  const [source, setSource] = useState<Source>("momence");

  const sourceToggle = (
    <FilterPillGroupV2
      options={[
        { key: "momence", label: "Momence" },
        { key: "urban", label: "Urban" },
      ]}
      active={source}
      onChange={setSource}
      variant="segmented"
    />
  );

  return (
    <div className="flex flex-col items-center w-full">
      {source === "momence" ? (
        <ClientesMatrizCompras customers={customers} payments={payments} urbanClients={urbanClients} extraControls={sourceToggle} />
      ) : (
        <ClientesMatrizUrban rows={urbanClients} clients={clients} payments={payments} extraControls={sourceToggle} />
      )}
    </div>
  );
}
