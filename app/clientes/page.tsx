export const dynamic = "force-dynamic";

import { fmt } from "@/lib/analytics";
import { loadStripePayments } from "@/lib/stripePayments";
import {
  loadStripeSubscriptions,
  activeSubs,
  mrrFromSubs,
  churnedThisMonth,
  renewingInDays,
} from "@/lib/stripeSubscriptions";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import ClientesTable from "./ClientesTable";

function pad2(n: number) { return String(n).padStart(2, "0"); }

function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function ClientesPage() {
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  const [payments, subscriptions] = await Promise.all([
    loadStripePayments(),
    loadStripeSubscriptions(),
  ]);
  const customers = await loadStripeCustomers(payments, subscriptions);

  const active   = activeSubs(subscriptions).length;
  const mrr      = mrrFromSubs(subscriptions);
  const churned  = churnedThisMonth(subscriptions, curMonth).length;
  const total    = customers.length;
  const renewing = renewingInDays(subscriptions, 7);

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Clientes</h1>
        <p className="text-sm text-navy/40 mt-1">{total} clientes con pagos · datos en tiempo real de Stripe</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-xs text-navy/40 uppercase tracking-wider mb-1">Total clientes</p>
          <p className="text-2xl font-semibold text-navy">{total}</p>
        </div>
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-xs text-navy/40 uppercase tracking-wider mb-1">Subs activas</p>
          <p className="text-2xl font-semibold text-primary">{active}</p>
        </div>
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-xs text-navy/40 uppercase tracking-wider mb-1">MRR</p>
          <p className="text-2xl font-semibold text-success">{fmt(mrr)}</p>
        </div>
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-xs text-navy/40 uppercase tracking-wider mb-1">Bajas este mes</p>
          <p className={`text-2xl font-semibold ${churned > 0 ? "text-danger" : "text-navy/20"}`}>{churned}</p>
        </div>
      </div>

      {/* Renovaciones próximas */}
      {renewing.length > 0 && (
        <div className="mb-6 border border-warning/30 bg-warning/[0.06] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warning flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm font-semibold text-warning">
              {renewing.length} suscripción{renewing.length > 1 ? "es" : ""} renueva{renewing.length === 1 ? "" : "n"} en los próximos 7 días
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {renewing.map((sub) => (
              <div key={sub.id} className="bg-white border border-warning/20 rounded-md px-3 py-1.5 flex items-center gap-2">
                <span className="text-sm font-medium text-navy">{sub.customerName ?? sub.customerEmail ?? sub.customerId}</span>
                <span className="text-xs text-navy/40">{sub.plan}</span>
                <span className="text-xs text-warning font-medium">{fmtDate(sub.currentPeriodEnd)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla interactiva */}
      <ClientesTable customers={customers} />
    </main>
  );
}
