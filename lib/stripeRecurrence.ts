import type { StripePayment } from "./stripePayments";

function pad2(n: number) { return String(n).padStart(2, "0"); }

function monthOffset(baseDate: Date, offsetMonths: number): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + offsetMonths, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

// Months paid per customer in the last N months
function customerMonthSets(
  payments: StripePayment[],
  months: string[],
): Map<string, Set<string>> {
  const monthSet = new Set(months);
  const map = new Map<string, Set<string>>();
  for (const p of payments) {
    if (!p.customerId) continue;
    const m = p.date.slice(0, 7);
    if (!monthSet.has(m)) continue;
    const s = map.get(p.customerId) ?? new Set<string>();
    s.add(m);
    map.set(p.customerId, s);
  }
  return map;
}

// Set of customerIds who paid in at least minMonths of the last checkMonths months
export function recurringCustomerIds(
  payments: StripePayment[],
  curMonth: string,
  checkMonths = 3,
  minMonths = 2,
): Set<string> {
  const now = new Date(curMonth + "-01");
  const months = Array.from({ length: checkMonths }, (_, i) => monthOffset(now, -i));
  const map = customerMonthSets(payments, months);
  const result = new Set<string>();
  for (const [id, set] of map) {
    if (set.size >= minMonths) result.add(id);
  }
  return result;
}

// Estimated MRR from last 3 complete months (excludes current month)
export function estimatedMRR(payments: StripePayment[], curMonth: string): number {
  const now = new Date(curMonth + "-01");
  const months = [monthOffset(now, -1), monthOffset(now, -2), monthOffset(now, -3)];
  const totals = months.map((m) =>
    payments.filter((p) => p.date.startsWith(m)).reduce((s, p) => s + p.amount, 0),
  );
  const filled = totals.filter((t) => t > 0);
  return filled.length > 0 ? filled.reduce((a, b) => a + b, 0) / filled.length : 0;
}

// Count unique paying customers in a given month
export function activeCustomersInMonth(payments: StripePayment[], month: string): number {
  return new Set(
    payments.filter((p) => p.customerId && p.date.startsWith(month)).map((p) => p.customerId!),
  ).size;
}

// Customers who paid at least once in the last 30 days
export function activeCustomersLast30Days(payments: StripePayment[]): Set<string> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return new Set(
    payments
      .filter((p) => p.customerId && p.date >= cutoffStr)
      .map((p) => p.customerId!),
  );
}

// Customers whose FIRST ever payment was in the last 30 days
export function newCustomersLast30Days(payments: StripePayment[]): Set<string> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const firstPayment = new Map<string, string>();
  for (const p of payments) {
    if (!p.customerId) continue;
    const prev = firstPayment.get(p.customerId);
    if (!prev || p.date < prev) firstPayment.set(p.customerId, p.date);
  }

  const result = new Set<string>();
  for (const [id, date] of firstPayment) {
    if (date >= cutoffStr) result.add(id);
  }
  return result;
}

// Customers who paid last month but NOT current month (possible churn)
export function possibleChurnIds(
  payments: StripePayment[],
  curMonth: string,
): Set<string> {
  const now = new Date(curMonth + "-01");
  const prevMonth = monthOffset(now, -1);

  const paidPrev = new Set(
    payments.filter((p) => p.customerId && p.date.startsWith(prevMonth)).map((p) => p.customerId!),
  );
  const paidCur = new Set(
    payments.filter((p) => p.customerId && p.date.startsWith(curMonth)).map((p) => p.customerId!),
  );

  const result = new Set<string>();
  for (const id of paidPrev) {
    if (!paidCur.has(id)) result.add(id);
  }
  return result;
}
