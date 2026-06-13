export const dynamic = "force-dynamic";

import { fmt } from "@/lib/analytics";
import { loadStripePayments } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import {
  estimatedMRR,
  activeCustomersInMonth,
  possibleChurnIds,
} from "@/lib/stripeRecurrence";
import ClientesTable from "./ClientesTable";

function pad2(n: number) { return String(n).padStart(2, "0"); }

export default async function ClientesPage() {
  const now = new Date();
  const curMonth  = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const prevMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  })();

  const payments  = await loadStripePayments();
  const customers = await loadStripeCustomers(payments, curMonth);

  const total      = customers.length;
  const recurring  = customers.filter((c) => c.isRecurring).length;
  const mrr        = estimatedMRR(payments, curMonth);
  const activeNow  = activeCustomersInMonth(payments, curMonth);
  const churnIds   = possibleChurnIds(payments, curMonth);
  const churnCount = churnIds.size;

  // Flag churn on customer objects for the table
  const customersWithChurn = customers.map((c) => ({
    ...c,
    possibleChurn: churnIds.has(c.id),
  }));

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Clientes</h1>
        <p className="text-sm text-navy/40 mt-1">
          {total} clientes · datos en tiempo real de Stripe
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-xs text-navy/40 uppercase tracking-wider mb-1">Total clientes</p>
          <p className="text-2xl font-semibold text-navy">{total}</p>
        </div>
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-xs text-navy/40 uppercase tracking-wider mb-1">Recurrentes</p>
          <p className="text-2xl font-semibold text-primary">{recurring}</p>
          <p className="text-xs text-navy/30 mt-1">2+ meses de 3</p>
        </div>
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-xs text-navy/40 uppercase tracking-wider mb-1">MRR estimado</p>
          <p className="text-2xl font-semibold text-success">{fmt(mrr)}</p>
          <p className="text-xs text-navy/30 mt-1">media 3 meses</p>
        </div>
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-xs text-navy/40 uppercase tracking-wider mb-1">Posibles bajas</p>
          <p className={`text-2xl font-semibold ${churnCount > 0 ? "text-warning" : "text-navy/20"}`}>
            {churnCount}
          </p>
          <p className="text-xs text-navy/30 mt-1">pagaron en {prevMonth.slice(5)} no en {curMonth.slice(5)}</p>
        </div>
      </div>

      {/* Alerta posibles bajas */}
      {churnCount > 0 && (
        <div className="mb-6 border border-warning/30 bg-warning/[0.06] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm font-semibold text-warning">
              {churnCount} cliente{churnCount > 1 ? "s" : ""} que pagaron el mes pasado no han pagado este mes
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {customersWithChurn
              .filter((c) => c.possibleChurn)
              .map((c) => (
                <span key={c.id} className="bg-white border border-warning/20 rounded-md px-3 py-1 text-sm font-medium text-navy">
                  {c.name ?? c.email ?? c.id}
                </span>
              ))}
          </div>
        </div>
      )}

      <ClientesTable customers={customersWithChurn} />
    </main>
  );
}
