import { loadTransactionsCached } from "@/lib/transactions";
import { loadStripePaymentsCached } from "@/lib/stripePayments";
import { getMemberships, getCustomers } from "@/lib/momence";
import { subscriptionTiersFromMemberships, computeMrrByTier } from "@/lib/mrr";
import {
  detectRecurringExpenses,
  avgPackRevenuePerMonth,
  historicalMonthly,
  historicalByCategory,
} from "@/lib/previsiones";
import PrevisionesTable from "./PrevisionesTable";

export default async function PrevisionesLoader() {
  const [txnsAll, paymentsAll, memberships, customers] = await Promise.all([
    loadTransactionsCached(),
    loadStripePaymentsCached(),
    getMemberships(),
    getCustomers(),
  ]);

  const tiers = subscriptionTiersFromMemberships(memberships);
  const tierMrr = computeMrrByTier(customers, tiers);
  const baseMrr = tierMrr.reduce((s, t) => s + t.mrr, 0);

  const packsBase = avgPackRevenuePerMonth(paymentsAll);
  const recurringExpenses = detectRecurringExpenses(txnsAll);
  const historical = historicalMonthly(txnsAll);
  const historicalByCat = historicalByCategory(txnsAll);

  const latestBal = [...txnsAll]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((t) => t.balance !== null);
  const startingBalance = latestBal?.balance ?? 0;

  return (
    <PrevisionesTable
      baseMrr={baseMrr}
      packsBase={packsBase}
      startingBalance={startingBalance}
      recurringExpenses={recurringExpenses}
      historical={historical}
      historicalByCat={historicalByCat}
    />
  );
}
