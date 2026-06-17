import type { Transaction } from "./transactions";
import type { StripePayment } from "./stripePayments";

const MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export function forecastMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecurringExpense = {
  category: string;
  avgMonthly: number;
  monthsDetected: number;
};

export type ForecastParams = {
  mrrBase: number;           // MRR actual (editable)
  packsBase: number;         // Ingresos medios packs/clases/mes (editable)
  crecimientoPct: number;    // % crecimiento mensual de ingresos (default 0)
  retencionesPct: number;    // % retenido en facturación recibida (IRPF, default 0)
  prestamo: number;          // amortización mensual de préstamo (default 0)
  salarioAumentoPct: number; // % aumento sobre salarios base (default 0)
};

export type MonthlyForecast = {
  month: string;
  label: string;
  saldoInicial: number;
  mrr: number;
  packs: number;
  retenciones: number;
  totalEntradas: number;
  expenses: { category: string; amount: number }[];
  prestamo: number;
  totalSalidas: number;
  resultado: number;
  saldoFinal: number;
};

// ── Expense detection ─────────────────────────────────────────────────────────

const SALARY_CATS = new Set(["Salarios"]);

export function detectRecurringExpenses(txns: Transaction[]): RecurringExpense[] {
  const byCat = new Map<string, { months: Set<string>; total: number }>();
  for (const t of txns) {
    if (t.amount >= 0) continue;
    const month = t.date.slice(0, 7);
    if (!byCat.has(t.category)) byCat.set(t.category, { months: new Set(), total: 0 });
    const entry = byCat.get(t.category)!;
    entry.months.add(month);
    entry.total += Math.abs(t.amount);
  }

  const result: RecurringExpense[] = [];
  for (const [cat, { months, total }] of byCat) {
    if (months.size < 2) continue;
    result.push({ category: cat, avgMonthly: total / months.size, monthsDetected: months.size });
  }
  return result.sort((a, b) => b.avgMonthly - a.avgMonthly);
}

// ── Pack revenue baseline ─────────────────────────────────────────────────────

export function avgPackRevenuePerMonth(payments: StripePayment[]): number {
  const nonSub = payments.filter((p) => p.category === "Pago único");
  const byMonth = new Map<string, number>();
  for (const p of nonSub) {
    const m = p.date.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + p.amount);
  }
  if (byMonth.size === 0) return 0;
  return [...byMonth.values()].reduce((s, v) => s + v, 0) / byMonth.size;
}

// ── Forecast builder ──────────────────────────────────────────────────────────

export function buildForecast(
  startingBalance: number,
  recurringExpenses: RecurringExpense[],
  params: ForecastParams,
  months = 12,
): MonthlyForecast[] {
  const now = new Date();
  const forecast: MonthlyForecast[] = [];
  let saldo = startingBalance;

  for (let i = 0; i < months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = forecastMonthLabel(ym);

    const growthFactor = Math.pow(1 + params.crecimientoPct / 100, i);
    const mrr   = params.mrrBase  * growthFactor;
    const packs = params.packsBase * growthFactor;
    const gross = mrr + packs;
    const retenciones = gross * (params.retencionesPct / 100);
    const totalEntradas = gross - retenciones;

    const expenses = recurringExpenses.map((e) => ({
      category: e.category,
      amount: SALARY_CATS.has(e.category)
        ? e.avgMonthly * (1 + params.salarioAumentoPct / 100)
        : e.avgMonthly,
    }));
    const totalSalidas = expenses.reduce((s, e) => s + e.amount, 0) + params.prestamo;

    const resultado  = totalEntradas - totalSalidas;
    const saldoFinal = saldo + resultado;

    forecast.push({
      month: ym, label,
      saldoInicial: saldo,
      mrr, packs, retenciones, totalEntradas,
      expenses, prestamo: params.prestamo,
      totalSalidas, resultado, saldoFinal,
    });

    saldo = saldoFinal;
  }
  return forecast;
}
