export const dynamic = "force-dynamic";

import { loadStripePaymentsCached, loadPaymentsBreakdown30d } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { estimatedMRR, activeCustomersLast30Days, newCustomersLast30Days } from "@/lib/stripeRecurrence";
import { loadBusinessEvents } from "@/lib/businessEvents";
import ClientesShell from "./ClientesShell";
import ClientesKPIs from "./ClientesKPIs";
import ClientesPaymentsBreakdown from "./ClientesPaymentsBreakdown";

function pad2(n: number) { return String(n).padStart(2, "0"); }

export default async function ClientesPage() {
  const now = new Date();
  const curMonth  = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const prevMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  })();
  const payments = await loadStripePaymentsCached();
  const [customers, businessEvents, breakdown] = await Promise.all([
    loadStripeCustomers(payments, curMonth),
    loadBusinessEvents(),
    loadPaymentsBreakdown30d(),
  ]);

  const total      = customers.length;
  const mrr        = estimatedMRR(payments, curMonth);
  const activeIds  = activeCustomersLast30Days(payments);
  const newIds     = newCustomersLast30Days(payments);

  // Métricas rolling 30d vs período anterior (días 31-60)
  const day30ago = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
  const day60ago = new Date(now.getTime() - 60 * 86400000).toISOString().split("T")[0];

  const p30d     = payments.filter((p) => p.date >= day30ago);
  const pPrev30d = payments.filter((p) => p.date >= day60ago && p.date < day30ago);

  const grossRevenue30d     = p30d.reduce((s, p) => s + p.amount, 0);
  const grossRevenuePrev30d = pPrev30d.reduce((s, p) => s + p.amount, 0);

  const activeSet30d     = new Set(p30d.filter((p) => p.customerId).map((p) => p.customerId!));
  const activeSetPrev30d = new Set(pPrev30d.filter((p) => p.customerId).map((p) => p.customerId!));

  // Clientes nuevos: primer pago dentro del período
  const firstPaymentMap = new Map<string, string>(); // stripeId → fecha primer pago
  for (const p of payments) {
    if (!p.customerId) continue;
    const ex = firstPaymentMap.get(p.customerId);
    if (!ex || p.date < ex) firstPaymentMap.set(p.customerId, p.date);
  }
  let newCount30d = 0, newCountPrev30d = 0;
  for (const firstDate of firstPaymentMap.values()) {
    if (firstDate >= day30ago) newCount30d++;
    else if (firstDate >= day60ago) newCountPrev30d++;
  }

  // Último pago por tipo — suscripciones y packs tienen ventanas de caducidad distintas
  const lastSubById  = new Map<string, { date: string; product: string }>();
  const lastPackById = new Map<string, { date: string; product: string }>();

  for (const p of payments) {
    if (!p.customerId) continue;
    if (p.inferredType === "subscription") {
      const ex = lastSubById.get(p.customerId);
      if (!ex || p.date > ex.date) lastSubById.set(p.customerId, { date: p.date, product: p.inferredProduct });
    } else if (p.inferredType === "pack" && p.inferredProduct !== "Clase suelta") {
      const ex = lastPackById.get(p.customerId);
      if (!ex || p.date > ex.date) lastPackById.set(p.customerId, { date: p.date, product: p.inferredProduct });
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
    return {
      ...c,
      daysSinceLastSub:  lastSub  ? daysSince(lastSub.date)  : null,
      daysSinceLastPack: lastPack ? daysSince(lastPack.date) : null,
      lastPackProduct:   lastPack?.product ?? null,
      lastSubProduct:    lastSub?.product  ?? null,
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
          grossRevenue30d={grossRevenue30d}
          grossRevenuePrev30d={grossRevenuePrev30d}
          newCount30d={newCount30d}
          newCountPrev30d={newCountPrev30d}
          activeCount30d={activeSet30d.size}
          activeCountPrev30d={activeSetPrev30d.size}
        />

        <ClientesPaymentsBreakdown
          succeeded={grossRevenue30d}
          refunded={breakdown.refunded}
          disputed={breakdown.disputed}
          failed={breakdown.failed}
        />

        <ClientesShell customers={customersWithChurn} payments={payments} events={businessEvents} />
      </div>
    </div>
  );
}
