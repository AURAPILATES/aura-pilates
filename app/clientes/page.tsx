export const dynamic = "force-dynamic";

import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { estimatedMRR, activeCustomersLast30Days, newCustomersLast30Days } from "@/lib/stripeRecurrence";
import { loadBusinessEvents } from "@/lib/businessEvents";
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
  const prevPrevMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  })();

  const payments = await loadStripePaymentsCached();
  const [customers, businessEvents] = await Promise.all([
    loadStripeCustomers(payments, curMonth),
    loadBusinessEvents(),
  ]);

  const total      = customers.length;
  const mrr        = estimatedMRR(payments, curMonth);
  const activeIds  = activeCustomersLast30Days(payments);
  const newIds     = newCustomersLast30Days(payments);

  // Último pago por tipo — suscripciones y packs tienen ventanas de caducidad distintas
  const lastSubById  = new Map<string, { date: string; product: string }>();
  const lastPackById = new Map<string, { date: string; product: string }>();
  const packMonthSets = new Map<string, Set<string>>();
  const checkMonths = new Set([curMonth, prevMonth, prevPrevMonth]);

  for (const p of payments) {
    if (!p.customerId) continue;
    if (p.category === "Suscripción") {
      const ex = lastSubById.get(p.customerId);
      if (!ex || p.date > ex.date) lastSubById.set(p.customerId, { date: p.date, product: p.inferredProduct });
    } else {
      const m = p.date.slice(0, 7);
      if (checkMonths.has(m)) {
        const s = packMonthSets.get(p.customerId) ?? new Set<string>();
        s.add(m);
        packMonthSets.set(p.customerId, s);
      }
      if (p.inferredProduct !== "Clase suelta" && p.inferredProduct !== "Con cupón") {
        const ex = lastPackById.get(p.customerId);
        if (!ex || p.date > ex.date) lastPackById.set(p.customerId, { date: p.date, product: p.inferredProduct });
      }
    }
  }

  const today = new Date();
  function daysSince(dateStr: string): number {
    return Math.floor((today.getTime() - new Date(dateStr + "T12:00:00").getTime()) / 86_400_000);
  }

  const customersWithChurn = customers.map((c) => {
    let lastSub:  { date: string; product: string } | null = null;
    let lastPack: { date: string; product: string } | null = null;
    for (const sid of c.stripeIds) {
      const sub  = lastSubById.get(sid);
      if (sub  && (!lastSub  || sub.date  > lastSub.date))  lastSub  = sub;
      const pack = lastPackById.get(sid);
      if (pack && (!lastPack || pack.date > lastPack.date)) lastPack = pack;
    }
    const isPackRecurring = !c.isRecurring && (() => {
      const allMonths = new Set<string>();
      for (const sid of c.stripeIds) {
        packMonthSets.get(sid)?.forEach((m) => allMonths.add(m));
      }
      return allMonths.size >= 2;
    })();
    return {
      ...c,
      daysSinceLastSub:  lastSub  ? daysSince(lastSub.date)  : null,
      daysSinceLastPack: lastPack ? daysSince(lastPack.date) : null,
      lastPackProduct:   lastPack?.product ?? null,
      lastSubProduct:    lastSub?.product  ?? null,
      isPackRecurring,
      isActive: activeIds.has(c.id),
      isNew:    newIds.has(c.id),
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

        <ClientesShell customers={customersWithChurn} payments={payments} events={businessEvents} />
      </div>
    </div>
  );
}
