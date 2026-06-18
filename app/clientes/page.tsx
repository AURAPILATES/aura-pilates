export const dynamic = "force-dynamic";

import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { loadStripeCustomers } from "@/lib/stripeCustomers";
import { estimatedMRR } from "@/lib/stripeRecurrence";
import { loadBusinessEvents } from "@/lib/businessEvents";
import ClientesShell from "./ClientesShell";
import ClientesKPIs from "./ClientesKPIs";
import ClientesFilterBar from "./ClientesFilterBar";

function pad2(n: number) { return String(n).padStart(2, "0"); }

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(to + "T12:00:00").getTime() - new Date(from + "T12:00:00").getTime()) / 86400000,
  );
}

function fmtShort(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y.slice(2)}`;
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // ── Parse filter params ──────────────────────────────────────────────────────
  const periodParam  = typeof sp.period      === "string" ? sp.period      : "30";
  const customFrom   = typeof sp.from        === "string" ? sp.from        : "";
  const customTo     = typeof sp.to          === "string" ? sp.to          : "";
  const compareParam = typeof sp.compareWith === "string" ? sp.compareWith : "previous";
  const cpFrom       = typeof sp.compareFrom === "string" ? sp.compareFrom : "";
  const cpTo         = typeof sp.compareTo   === "string" ? sp.compareTo   : "";

  // ── Main period ───────────────────────────────────────────────────────────────
  let mainFrom: string;
  let mainTo: string = todayStr;

  if (periodParam === "custom" && customFrom && customTo) {
    mainFrom = customFrom;
    mainTo   = customTo;
  } else {
    const days = periodParam === "7" ? 7 : periodParam === "90" ? 90 : 30;
    mainFrom = addDays(todayStr, -days);
  }

  // ── Comparison period ─────────────────────────────────────────────────────────
  let compFrom: string;
  let compTo: string;

  if (compareParam === "custom" && cpFrom && cpTo) {
    compFrom = cpFrom;
    compTo   = cpTo;
  } else {
    const duration = daysBetween(mainFrom, mainTo);
    compTo   = addDays(mainFrom, -1);
    compFrom = addDays(compTo,   -duration);
  }

  // ── Period label ──────────────────────────────────────────────────────────────
  const periodLabel =
    periodParam === "7"  ? "7 días"  :
    periodParam === "30" ? "30 días" :
    periodParam === "90" ? "90 días" :
    `${fmtShort(mainFrom)}–${fmtShort(mainTo)}`;

  const compDateRange = `${fmtShort(compFrom)}–${fmtShort(compTo)}`;

  // ── Fetch data ────────────────────────────────────────────────────────────────
  const curMonth  = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const prevMonth = (() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  })();

  const payments = await loadStripePaymentsCached();
  const [customers, businessEvents] = await Promise.all([
    loadStripeCustomers(payments, curMonth),
    loadBusinessEvents(),
  ]);

  const total = customers.length;
  const mrr   = estimatedMRR(payments, curMonth);

  // ── Filter payments to each period ───────────────────────────────────────────
  const pMain = payments.filter((p) => p.date >= mainFrom && p.date <= mainTo);
  const pComp = payments.filter((p) => p.date >= compFrom && p.date <= compTo);

  const grossRevenue     = pMain.reduce((s, p) => s + p.amount, 0);
  const grossRevenueComp = pComp.reduce((s, p) => s + p.amount, 0);

  const mainActiveSet = new Set(pMain.filter((p) => p.customerId).map((p) => p.customerId!));
  const compActiveSet = new Set(pComp.filter((p) => p.customerId).map((p) => p.customerId!));

  // ── New customers: first payment within each period ───────────────────────────
  const firstPaymentMap = new Map<string, string>();
  for (const p of payments) {
    if (!p.customerId) continue;
    const ex = firstPaymentMap.get(p.customerId);
    if (!ex || p.date < ex) firstPaymentMap.set(p.customerId, p.date);
  }

  const mainNewSet = new Set<string>();
  const compNewSet = new Set<string>();
  let newCountMain = 0, newCountComp = 0;
  for (const [cid, firstDate] of firstPaymentMap) {
    if (firstDate >= mainFrom && firstDate <= mainTo) { mainNewSet.add(cid); newCountMain++; }
    else if (firstDate >= compFrom && firstDate <= compTo) { compNewSet.add(cid); newCountComp++; }
  }

  // ── Last sub/pack by customer (structural, not period-dependent) ──────────────
  const lastSubById  = new Map<string, { date: string; product: string }>();
  const lastPackById = new Map<string, { date: string; product: string }>();

  for (const p of payments) {
    if (!p.customerId) continue;
    if (p.inferredType === "subscription") {
      const ex = lastSubById.get(p.customerId);
      if (!ex || p.date > ex.date) lastSubById.set(p.customerId, { date: p.date, product: p.inferredProduct });
    } else if (p.inferredType === "pack") {
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
      isActive: c.stripeIds.some((sid) => mainActiveSet.has(sid)),
      isNew:    c.stripeIds.some((sid) => mainNewSet.has(sid)),
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
        <ClientesFilterBar />

        <ClientesKPIs
          customers={customersWithChurn}
          mrr={mrr}
          prevMonthLabel={prevMonth.slice(5)}
          curMonthLabel={curMonth.slice(5)}
          periodLabel={periodLabel}
          periodFrom={mainFrom}
          periodTo={mainTo}
          compDateRange={compDateRange}
          grossRevenue={grossRevenue}
          grossRevenueComp={grossRevenueComp}
          newCount={newCountMain}
          newCountComp={newCountComp}
          activeCount={mainActiveSet.size}
          activeCountComp={compActiveSet.size}
        />

        <ClientesShell customers={customersWithChurn} payments={payments} events={businessEvents} />
      </div>
    </div>
  );
}
