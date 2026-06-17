export const dynamic = "force-dynamic";

import { loadTransactions } from "@/lib/transactions";
import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { getMemberships, getCustomers } from "@/lib/momence";
import { subscriptionTiersFromMemberships, computeMrrByTier } from "@/lib/mrr";
import {
  detectRecurringExpenses,
  avgPackRevenuePerMonth,
  historicalMonthly,
} from "@/lib/previsiones";
import PrevisionesTable from "./PrevisionesTable";

export default async function PrevisionesPage() {
  const [txnsAll, paymentsAll, memberships, customers] = await Promise.all([
    loadTransactions(),
    loadStripePaymentsCached(),
    getMemberships(),
    getCustomers(),
  ]);

  // MRR actual desde Momence
  const tiers = subscriptionTiersFromMemberships(memberships);
  const tierMrr = computeMrrByTier(customers, tiers);
  const baseMrr = tierMrr.reduce((s, t) => s + t.mrr, 0);

  // Media de ingresos por packs/clases desde Stripe
  const packsBase = avgPackRevenuePerMonth(paymentsAll);

  // Gastos recurrentes detectados en transacciones
  const recurringExpenses = detectRecurringExpenses(txnsAll);

  // Datos históricos agrupados por mes
  const historical = historicalMonthly(txnsAll);

  // Saldo inicial de la previsión = último saldo conocido del banco
  const latestBal = [...txnsAll]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null);
  const startingBalance = latestBal?.balance ?? 0;

  return (
    <div>
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[45px] flex items-center">
          <h1 className="text-sm font-bold text-navy uppercase tracking-widest">Previsiones</h1>
        </div>
      </div>

      <div className="px-4 sm:px-6 pt-6 pb-16 max-w-6xl mx-auto">
        <PrevisionesTable
          baseMrr={baseMrr}
          packsBase={packsBase}
          startingBalance={startingBalance}
          recurringExpenses={recurringExpenses}
          historical={historical}
        />
      </div>
    </div>
  );
}
