"use client";

import { useState, useRef } from "react";
import ClientesTable, { type ClientesTableHandle, type CustomerRow } from "./ClientesTable";
import ClientesEvolucionChart from "./ClientesEvolucionChart";
import ClientesRetentionCohort from "./ClientesRetentionCohort";
import ChurnAlert from "./ChurnAlert";
import type { StripePayment } from "@/lib/stripePayments";

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
};

export default function ClientesShell({ customers, payments }: Props) {
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const tableRef = useRef<ClientesTableHandle>(null);

  const churnCustomers = customers.filter((c) => c.possibleChurn);

  function handleBarClick(month: string) {
    setActiveMonth((prev) => (prev === month ? null : month));
  }

  return (
    <>
      <ClientesEvolucionChart
        payments={payments}
        onBarClick={handleBarClick}
        activeMonth={activeMonth}
      />
      <ClientesRetentionCohort
        payments={payments}
        onMonthClick={handleBarClick}
      />
      {churnCustomers.length > 0 && (
        <ChurnAlert
          customers={churnCustomers.map((c) => ({ name: c.name ?? c.email ?? c.id, id: c.id }))}
          onSelect={(id) => { tableRef.current?.openCustomer(id); }}
        />
      )}
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
