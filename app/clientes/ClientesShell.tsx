"use client";

import { useState, useRef } from "react";
import ClientesTable, { type ClientesTableHandle, type CustomerRow } from "./ClientesTable";
import ClientesEvolucionChart from "./ClientesEvolucionChart";
import ClientesRetentionCohort from "./ClientesRetentionCohort";
import ClientesMatrizCompras from "./ClientesMatrizCompras";
import type { StripePayment } from "@/lib/stripePayments";
import type { BusinessEvent } from "@/lib/businessEvents";

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
  events?: BusinessEvent[];
};

export default function ClientesShell({ customers, payments, events }: Props) {
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const tableRef = useRef<ClientesTableHandle>(null);

  function handleBarClick(month: string) {
    setActiveMonth((prev) => (prev === month ? null : month));
  }

  return (
    <>
      <ClientesEvolucionChart
        payments={payments}
        onBarClick={handleBarClick}
        activeMonth={activeMonth}
        events={events}
      />
      <ClientesRetentionCohort
        payments={payments}
        onMonthClick={handleBarClick}
      />
      <ClientesMatrizCompras
        customers={customers}
        payments={payments}
      />
      <ClientesTable
        ref={tableRef}
        customers={customers}
        payments={payments}
        activeMonth={activeMonth}
        onClearMonth={() => setActiveMonth(null)}
      />
    </>
  );
}
