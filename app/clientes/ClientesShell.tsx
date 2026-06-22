"use client";

import { useState, useRef } from "react";
import ClientesTable, { type ClientesTableHandle, type CustomerRow } from "./ClientesTable";
import ClientesRetentionCohort from "./ClientesRetentionCohort";
import ClientesMatrizCompras from "./ClientesMatrizCompras";
import type { StripePayment } from "@/lib/stripePayments";

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
};

export default function ClientesShell({ customers, payments }: Props) {
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const tableRef = useRef<ClientesTableHandle>(null);

  function handleBarClick(month: string) {
    setActiveMonth((prev) => (prev === month ? null : month));
  }

  return (
    <>
      <ClientesRetentionCohort
        payments={payments}
        customers={customers}
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
