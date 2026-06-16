export const dynamic = "force-dynamic";

import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { estimatedMRR, possibleChurnIds, activeCustomersLast30Days, newCustomersLast30Days } from "@/lib/stripeRecurrence";
import ClientesTable from "./ClientesTable";
import ClientesKPIs from "./ClientesKPIs";
import ClientesEvolucionChart from "./ClientesEvolucionChart";
import ChurnAlert from "./ChurnAlert";

function pad2(n: number) { return String(n).padStart(2, "0"); }

export default async function ClientesPage() {
  const now = new Date();
  const curMonth  = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const prevMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  })();

  const payments  = await loadStripePaymentsCached();
  const customers = await loadStripeCustomers(payments, curMonth);

  const total      = customers.length;
  const mrr        = estimatedMRR(payments, curMonth);
  const churnIds   = possibleChurnIds(payments, curMonth);
  const activeIds  = activeCustomersLast30Days(payments);
  const newIds     = newCustomersLast30Days(payments);
  const churnCount = churnIds.size;

  const customersWithChurn = customers.map((c) => ({
    ...c,
    possibleChurn: churnIds.has(c.id),
    isActive: activeIds.has(c.id),
    isNew: newIds.has(c.id),
  }));

  return (
    <div>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center justify-between gap-3">
          <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Clientes</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-navy/45">{total} clientes</span>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <ClientesKPIs
          customers={customersWithChurn}
          mrr={mrr}
          prevMonthLabel={prevMonth.slice(5)}
          curMonthLabel={curMonth.slice(5)}
        />

        <ClientesEvolucionChart payments={payments} />

        {churnCount > 0 && (
          <ChurnAlert
            count={churnCount}
            names={customersWithChurn.filter((c) => c.possibleChurn).map((c) => c.name ?? c.email ?? c.id)}
          />
        )}

        <ClientesTable customers={customersWithChurn} payments={payments} />
      </div>
    </div>
  );
}
