"use client";

import { useState, useRef } from "react";
import ClientesTable, { type ClientesTableHandle, type CustomerRow } from "./ClientesTable";
import ClientesEvolucionChart from "./ClientesEvolucionChart";
import ClientesRetentionCohort from "./ClientesRetentionCohort";
import ChurnAlert from "./ChurnAlert";
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

  const churnCustomers = customers.filter((c) => {
    if (c.isRecurring) return c.daysSinceLastSub != null && c.daysSinceLastSub > 30;
    if (c.daysSinceLastPack != null && c.lastPackProduct) {
      if (c.lastPackProduct === "Pack Benvinguda") return c.daysSinceLastPack > 15;
      if (c.lastPackProduct === "Pack 4 clases" || c.lastPackProduct === "Pack 8 clases") return c.daysSinceLastPack > 90;
    }
    return false;
  });

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
