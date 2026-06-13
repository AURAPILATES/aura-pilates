import { fmt } from "@/lib/analytics";
import { loadStripePayments } from "@/lib/stripePayments";
import { loadStripeSubscriptions, activeSubs, mrrFromSubs, churnedThisMonth } from "@/lib/stripeSubscriptions";
import { loadStripeCustomers } from "@/lib/stripeCustomers";

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

      {/* Tabla */}
      <div className="bg-white border border-navy/10 rounded shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/[0.06]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider">Plan</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider">Total gastado</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider hidden sm:table-cell">Pagos</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider hidden sm:table-cell">Último pago</th>
                <th className="text-center px-5 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr
                  key={c.id}
                  className={`border-b border-navy/[0.04] last:border-0 hover:bg-navy/[0.015] transition-colors ${
                    i % 2 === 0 ? "" : "bg-navy/[0.008]"
                  }`}
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-navy truncate max-w-[160px]">{c.name ?? "—"}</p>
                    {c.email && <p className="text-[11px] text-navy/35 truncate max-w-[160px]">{c.email}</p>}
                  </td>
                  <td className="px-5 py-3 text-navy/60">
                    {c.subscription ? (
                      <span className="text-xs bg-primary/[0.08] text-primary px-2 py-0.5 rounded-full font-medium">
                        {c.subscription.plan}
                      </span>
                    ) : (
                      <span className="text-xs text-navy/30">Sin suscripción</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-navy tabular-nums">{fmt(c.totalSpent)}</td>
                  <td className="px-5 py-3 text-right text-navy/50 hidden sm:table-cell">{c.paymentCount}</td>
                  <td className="px-5 py-3 text-right text-navy/40 text-xs hidden sm:table-cell">
                    {c.lastPaymentDate ? c.lastPaymentDate.split("-").reverse().join("/") : "—"}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {c.subscription ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-success" title="Activo" />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-navy/20" title="Inactivo" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
