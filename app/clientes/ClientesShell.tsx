"use client";

import { useEffect, useState, useRef } from "react";
import ClientesTable, { type ClientesTableHandle, type CustomerRow } from "./ClientesTable";
import ClientesMatrizCompras from "./ClientesMatrizCompras";
import type { StripePayment } from "@/lib/stripePayments";

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
};

type Tab = "estado" | "compras";

export default function ClientesShell({ customers, payments }: Props) {
  const [tab, setTab] = useState<Tab>("estado");
  const [mounted, setMounted] = useState<Record<Tab, boolean>>({ estado: true, compras: false });
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const tableRef = useRef<ClientesTableHandle>(null);

  useEffect(() => { setMounted((m) => ({ ...m, [tab]: true })); }, [tab]);

  return (
    <>
      <div className="flex border border-navy/[0.08] rounded-lg overflow-hidden bg-white text-xs w-fit mb-5">
        <button
          onClick={() => setTab("estado")}
          className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${tab === "estado" ? "bg-navy text-white font-medium" : "text-navy/50 hover:text-navy"}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Estado de clientes
        </button>
        <button
          onClick={() => setTab("compras")}
          className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${tab === "compras" ? "bg-navy text-white font-medium" : "text-navy/50 hover:text-navy"}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/>
          </svg>
          Historial de compras
        </button>
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
