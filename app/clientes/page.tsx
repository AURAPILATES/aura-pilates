export const dynamic = "force-dynamic";

import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { estimatedMRR, activeCustomersLast30Days, newCustomersLast30Days } from "@/lib/stripeRecurrence";
import ClientesShell from "./ClientesShell";
import ClientesKPIs from "./ClientesKPIs";

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
  const activeIds  = activeCustomersLast30Days(payments);
  const newIds     = newCustomersLast30Days(payments);

  // Último pago por customerId (para saber tipo del pago más reciente por cliente)
  const lastPmtById = new Map<string, { date: string; category: string }>();
  for (const p of payments) {
    if (!p.customerId) continue;
    const ex = lastPmtById.get(p.customerId);
    if (!ex || p.date > ex.date) lastPmtById.set(p.customerId, { date: p.date, category: p.category });
  }

  const today = new Date();
  const customersWithChurn = customers.map((c) => {
    // Último pago real entre todos los IDs fusionados
    let lastPmt: { date: string; category: string } | null = null;
    for (const sid of c.stripeIds) {
      const p = lastPmtById.get(sid);
      if (p && (!lastPmt || p.date > lastPmt.date)) lastPmt = p;
    }
    const daysSinceLast = lastPmt
      ? Math.floor((today.getTime() - new Date(lastPmt.date + "T12:00:00").getTime()) / 86_400_000)
      : null;
    return {
      ...c,
      // Posible baja: suscriptora cuyo ciclo mensual ya venció (>30 días sin renovar).
      // Solo aplica si el último pago fue una suscripción — clientes de clases sueltas no cuentan.
      possibleChurn:
        c.isRecurring &&
        daysSinceLast !== null &&
        daysSinceLast > 30 &&
        lastPmt?.category === "Suscripción",
      daysSinceLast,
      isActive: activeIds.has(c.id),
      isNew: newIds.has(c.id),
    };
  });

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

        <ClientesShell customers={customersWithChurn} payments={payments} />
      </div>
    </div>
  );
}
