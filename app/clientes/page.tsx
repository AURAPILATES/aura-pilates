export const dynamic = "force-dynamic";

import { fmt } from "@/lib/analytics";
import { loadStripePayments } from "@/lib/stripePayments";
import { loadStripeSubscriptions, activeSubs, mrrFromSubs, churnedThisMonth } from "@/lib/stripeSubscriptions";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import ClientesTable from "./ClientesTable";

function pad2(n: number) { return String(n).padStart(2, "0"); }

export default async function ClientesPage() {
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;

  const [payments, subscriptions] = await Promise.all([
    loadStripePayments(),
    loadStripeSubscriptions(),
  ]);
  const customers = await loadStripeCustomers(payments, subscriptions);

  const active  = activeSubs(subscriptions).length;
  const mrr     = mrrFromSubs(subscriptions);
  const churned = churnedThisMonth(subscriptions, curMonth).length;
  const total   = customers.length;

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Clientes</h1>
        <p className="text-sm text-navy/40 mt-1">{total} clientes con pagos · datos en tiempo real de Stripe</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
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

      {/* Tabla interactiva */}
      <ClientesTable customers={customers} />
    </main>
  );
}
