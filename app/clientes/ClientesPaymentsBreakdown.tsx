"use client";

import { useState } from "react";
import { fmt } from "@/lib/analytics";
import Drawer from "@/app/components/Drawer";
import { ChartCard } from "@/components/charts";
import type { PaymentsBreakdown } from "@/lib/stripePayments";
import type { CustomerRow } from "./ClientesTable";

type SegmentKey = "succeeded" | "refunded" | "disputed" | "failed";

type Props = PaymentsBreakdown & {
  succeeded: number;
  succeededIds?: string[];
  customers?: CustomerRow[];
  periodLabel: string;
  excludeSegments?: SegmentKey[];
};

const ITEMS: { key: SegmentKey; label: string; bg: string; drawerTitle: string }[] = [
  { key: "succeeded", label: "Efectuado",   bg: "bg-[#635bff]", drawerTitle: "Pagos efectuados"       },
  { key: "refunded",  label: "Reembolsada", bg: "bg-[#0ea5e9] dark:bg-[#27b3f2]", drawerTitle: "Reembolsos"              },
  { key: "disputed",  label: "Bloqueado",   bg: "bg-[#f97316] dark:bg-[#f9791f]", drawerTitle: "Disputas / Bloqueado"    },
  { key: "failed",    label: "Error",       bg: "bg-[#dc2626] dark:bg-[#dd7e7e]", drawerTitle: "Errores de pago"         },
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d.split("-").reverse().join("/");
}

export default function ClientesPaymentsBreakdown({
  succeeded, refunded, disputed, failed,
  succeededIds = [], refundedIds, disputedIds, failedIds,
  customers, periodLabel, excludeSegments = [],
}: Props) {
  const [open, setOpen] = useState<SegmentKey | null>(null);

  const values = { succeeded, refunded, disputed, failed };
  const ids    = { succeeded: succeededIds, refunded: refundedIds, disputed: disputedIds, failed: failedIds };
  const total  = succeeded + refunded + disputed + failed;

  const visible = ITEMS
    .filter((it) => !excludeSegments.includes(it.key))
    .filter((it) => values[it.key] > 0);

  const hasCustomers = !!(customers && customers.length > 0);

  function customersForSegment(key: SegmentKey): CustomerRow[] {
    if (!customers) return [];
    const segIds = new Set(ids[key]);
    return customers.filter((c) => c.stripeIds.some((sid) => segIds.has(sid)));
  }

  const drawerCustomers = open ? customersForSegment(open) : [];
  const drawerItem      = ITEMS.find((it) => it.key === open);

  return (
    <>
      <ChartCard
        title="Resumen de pagos"
        subtitle="Pagos efectuados y reembolsados en el período"
        dateRange={periodLabel}
        dataSource="Stripe · pagos en tiempo real"
        sources={["stripe"]}
      >
        {/* Barra proporcional */}
        <div className="flex rounded-full overflow-hidden h-2 mb-4 gap-[2px]">
          {total === 0
            ? <div className="flex-1 bg-navy/[0.06]" />
            : visible.map((it) => (
                <div
                  key={it.key}
                  onClick={hasCustomers ? () => setOpen(it.key) : undefined}
                  className={`${it.bg} ${hasCustomers ? "cursor-pointer hover:opacity-80" : ""} transition-opacity`}
                  style={{ width: `${(values[it.key] / total) * 100}%` }}
                  title={it.label}
                />
              ))}
        </div>

        {/* Desglose */}
        <div className="divide-y divide-navy/[0.05]">
          {visible.map((it) => (
            <div
              key={it.key}
              onClick={hasCustomers ? () => setOpen(it.key) : undefined}
              className={`flex items-center justify-between py-2.5 ${hasCustomers ? "cursor-pointer hover:bg-navy/[0.02] -mx-1 px-1 rounded-lg group" : ""} transition-colors`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${it.bg} shrink-0`} />
                <span className={`text-sm text-navy/65 ${hasCustomers ? "group-hover:text-navy" : ""} transition-colors`}>{it.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold tabular-nums ${it.key === "succeeded" ? "text-navy" : "text-navy/60"}`}>
                  {fmt(values[it.key])}
                </span>
                {hasCustomers && (
                  <span className="text-navy/25 text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      {open && drawerItem && hasCustomers && (
        <Drawer
          title={drawerItem.drawerTitle}
          subtitle={`${periodLabel}`}
          maxWidth="max-w-[420px]"
          footer={
            <p className="text-xs text-navy/45">{drawerCustomers.length} cliente{drawerCustomers.length !== 1 ? "s" : ""}</p>
          }
          onClose={() => setOpen(null)}
        >
          <div className="divide-y divide-navy/[0.05]">
            {drawerCustomers.length === 0 && (
              <p className="px-6 py-12 text-center text-sm text-navy/40">Sin clientes identificados.</p>
            )}
            {drawerCustomers.map((c) => (
              <div key={c.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{c.name ?? "Sin nombre"}</p>
                  {c.email && <p className="text-xs text-navy/50 truncate">{c.email}</p>}
                  <p className="text-xs text-navy/40 mt-0.5">Último pago: {fmtDate(c.lastPaymentDate)}</p>
                </div>
                <a
                  href={`https://dashboard.stripe.com/customers/${c.id}`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#635bff] rounded-lg hover:bg-[#4f46e5] transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  Stripe
                </a>
              </div>
            ))}
          </div>
        </Drawer>
      )}
    </>
  );
}
