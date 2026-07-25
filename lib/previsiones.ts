import { findCategory, type Transaction } from "./transactions";
import type { StripePayment } from "./stripePayments";
import { categoryDisplayLabel, NON_CASHFLOW_GROUP_TYPES, type Category } from "./categories";

const MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export function forecastMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

// ── Histórico: cuenta de resultados por categoría (brutos, según el banco) ─────
//
// Agrega los movimientos por mes y categoría, separando ingresos (importe ≥ 0) de gastos
// (importe < 0), excluyendo traspasos/movimientos internos (no son ingreso ni gasto real,
// mismo criterio que Flujo de caja en Analítica). Se agrega a nivel MENSUAL en el servidor;
// el cliente lo reagrupa a trimestre/año y encadena el saldo, para que el toggle sea instantáneo.

export type StatementCatMeta = { key: string; label: string; color: string };

export type StatementData = {
  /** Meses con actividad, orden cronológico ("YYYY-MM"). */
  months: string[];
  incomeCats: StatementCatMeta[];
  expenseCats: StatementCatMeta[];
  /** catKey → mes → importe (magnitud positiva). */
  incomeByCat: Record<string, Record<string, number>>;
  expenseByCat: Record<string, Record<string, number>>;
  /** Saldo bancario justo antes del primer movimiento conocido. */
  openingBalance: number;
};

const NONE_KEY = "__none__";
const NONE_COLOR = "#a1a1aa";

export function buildStatementData(txns: Transaction[], categories: Category[]): StatementData {
  const incomeByCat: Record<string, Record<string, number>> = {};
  const expenseByCat: Record<string, Record<string, number>> = {};
  const incomeTotals: Record<string, number> = {};
  const expenseTotals: Record<string, number> = {};
  const monthsSet = new Set<string>();

  for (const t of txns) {
    const cat = t.category ? findCategory(categories, t.category) : undefined;
    // Traspasos entre cuentas propias / movimientos internos: se ignoran.
    if (cat && NON_CASHFLOW_GROUP_TYPES.has(cat.group_type)) continue;
    const month = t.date.slice(0, 7);
    monthsSet.add(month);
    const key = cat ? cat.value : NONE_KEY;
    if (t.amount >= 0) {
      (incomeByCat[key] ??= {})[month] = (incomeByCat[key][month] ?? 0) + t.amount;
      incomeTotals[key] = (incomeTotals[key] ?? 0) + t.amount;
    } else {
      const v = Math.abs(t.amount);
      (expenseByCat[key] ??= {})[month] = (expenseByCat[key][month] ?? 0) + v;
      expenseTotals[key] = (expenseTotals[key] ?? 0) + v;
    }
  }

  function metaFor(key: string): StatementCatMeta {
    if (key === NONE_KEY) return { key, label: "Sin categoría", color: NONE_COLOR };
    const cat = findCategory(categories, key);
    return {
      key,
      label: cat ? categoryDisplayLabel(cat, categories) : key,
      color: cat?.text_color ?? NONE_COLOR,
    };
  }
  // Mayor gasto/ingreso primero; "Sin categoría" siempre al final.
  function sortKeys(totals: Record<string, number>): string[] {
    return Object.keys(totals).sort((a, b) => {
      if (a === NONE_KEY) return 1;
      if (b === NONE_KEY) return -1;
      return totals[b] - totals[a];
    });
  }

  const withBal = txns
    .filter((t) => t.balance !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const openingBalance = withBal.length > 0 ? withBal[0].balance! - withBal[0].amount : 0;

  return {
    months: [...monthsSet].sort(),
    incomeCats: sortKeys(incomeTotals).map(metaFor),
    expenseCats: sortKeys(expenseTotals).map(metaFor),
    incomeByCat,
    expenseByCat,
    openingBalance,
  };
}

// ── Reagrupación por período (cliente) ────────────────────────────────────────

export type Granularity = "month" | "quarter" | "year";

export function periodKeyOf(month: string, g: Granularity): string {
  const [y, m] = month.split("-");
  if (g === "year") return y;
  if (g === "quarter") return `${y}-Q${Math.floor((parseInt(m, 10) - 1) / 3) + 1}`;
  return month;
}

export function periodLabelOf(key: string, g: Granularity): string {
  if (g === "year") return key;
  if (g === "quarter") {
    const [y, q] = key.split("-Q");
    return `${q}T ${y.slice(2)}`;
  }
  return forecastMonthLabel(key);
}

// ── Capacity scenarios (from Excel "Aura Pilates Studio SL.xlsx") ─────────────

export type CapacityScenario = {
  id: string;
  label: string;
  sublabel: string;
  plazasMes: number;
  maxAlumnos: number;         // at 85% occupancy
  breakEvenAlumnos: number;
  salariosMes: number;        // coste empresa total mensual
};

// Data extracted from Excel sheets: SOUS INSTRUCTORS, 1 INSTRUCTOR, 1,5 INSTRUCTORS,
// 2 INSTRUCTORS, 2 INSTRUCT 30H. Salarios = coste empresa total.
export const CAPACITY_SCENARIOS: CapacityScenario[] = [
  {
    id: "actual",
    label: "Actual",
    sublabel: "Yuruaní 16h · Gisele 16h",
    plazasMes: 640,
    maxAlumnos: 75,
    breakEvenAlumnos: 63,
    salariosMes: 2660,       // 2500 coste empresa + 160 cash (L-V horario parcial)
  },
  {
    id: "1.5i",
    label: "1,5 instructores",
    sublabel: "2 instructores, uno parcial",
    plazasMes: 1200,
    maxAlumnos: 166,
    breakEvenAlumnos: 62,
    salariosMes: 3773,       // coste empresa 32h+parcial desde SOUS sheet
  },
  {
    id: "2i-30h",
    label: "2 instruct. 30h",
    sublabel: "Yuruaní 30h · Úrsula 30h",
    plazasMes: 1080,
    maxAlumnos: 150,
    breakEvenAlumnos: 76,
    salariosMes: 4364,       // 2244 + 2119 coste empresa
  },
  {
    id: "2i-40h",
    label: "2 instruct. 40h",
    sublabel: "Yuruaní 40h · Úrsula 40h",
    plazasMes: 1440,
    maxAlumnos: 200,
    breakEvenAlumnos: 76,
    salariosMes: 5818,       // 2992 + 2826 coste empresa
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecurringExpense = {
  category: string;
  avgMonthly: number;
  monthsDetected: number;
};

export type ForecastParams = {
  mrrBase: number;
  packsBase: number;
  crecimientoPct: number;
  retencionesPct: number;
  prestamo: number;
  salarioAumentoPct: number;
};

export type MonthlyActual = {
  month: string;
  label: string;
  entradas: number;
  salidas: number;
  resultado: number;
  saldoInicial: number | null;
  saldoFinal: number | null;
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

// ── Historical by-category breakdown ─────────────────────────────────────────

export type HistoricalByCategory = Record<string, Record<string, number>>;

export function historicalByCategory(txns: Transaction[]): HistoricalByCategory {
  const result: HistoricalByCategory = {};
  for (const t of txns) {
    if (t.amount >= 0 || !t.category) continue;
    const month = t.date.slice(0, 7);
    if (!result[t.category]) result[t.category] = {};
    result[t.category][month] = (result[t.category][month] ?? 0) + Math.abs(t.amount);
  }
  return result;
}

// ── Historical aggregation ────────────────────────────────────────────────────

export function historicalMonthly(txns: Transaction[]): MonthlyActual[] {
  const byMonth = new Map<string, {
    entradas: number;
    salidas: number;
    txnsSorted: Transaction[];
  }>();

  for (const t of txns) {
    const month = t.date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, { entradas: 0, salidas: 0, txnsSorted: [] });
    const e = byMonth.get(month)!;
    e.txnsSorted.push(t);
    if (t.amount > 0) e.entradas += t.amount;
    else e.salidas += Math.abs(t.amount);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => {
      const sorted = [...data.txnsSorted].sort((a, b) => a.date.localeCompare(b.date));
      const withBal = sorted.filter(t => t.balance !== null);
      const saldoFinal = withBal.length > 0 ? withBal[withBal.length - 1].balance : null;
      // balance field = balance after transaction; balance_before = balance - amount
      const saldoInicial = withBal.length > 0
        ? withBal[0].balance! - withBal[0].amount
        : null;

      return {
        month,
        label: forecastMonthLabel(month),
        entradas: data.entradas,
        salidas: data.salidas,
        resultado: data.entradas - data.salidas,
        saldoInicial,
        saldoFinal,
      };
    });
}

// ── Expense detection ─────────────────────────────────────────────────────────

const SALARY_CATS = new Set(["Salarios"]);

export function detectRecurringExpenses(txns: Transaction[]): RecurringExpense[] {
  const byCat = new Map<string, { months: Set<string>; total: number }>();
  for (const t of txns) {
    if (t.amount >= 0 || !t.category) continue;
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

// cellOverrides: rowKey → month → override value
// rowKeys: "mrr", "packs", or expense category string
export function buildForecast(
  startingBalance: number,
  recurringExpenses: RecurringExpense[],
  params: ForecastParams,
  salaryOverride?: number,
  months = 12,
  cellOverrides?: Record<string, Record<string, number>>,
): MonthlyForecast[] {
  const now = new Date();
  const forecast: MonthlyForecast[] = [];
  let saldo = startingBalance;

  for (let i = 0; i < months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = forecastMonthLabel(ym);

    const growthFactor = Math.pow(1 + params.crecimientoPct / 100, i);
    const mrr   = cellOverrides?.["mrr"]?.[ym]   ?? (params.mrrBase  * growthFactor);
    const packs = cellOverrides?.["packs"]?.[ym] ?? (params.packsBase * growthFactor);
    const gross = mrr + packs;
    const retenciones = gross * (params.retencionesPct / 100);
    const totalEntradas = gross - retenciones;

    const expenses = recurringExpenses.map((e) => ({
      category: e.category,
      amount: cellOverrides?.[e.category]?.[ym] ?? (
        SALARY_CATS.has(e.category)
          ? (salaryOverride ?? (e.avgMonthly * (1 + params.salarioAumentoPct / 100)))
          : e.avgMonthly
      ),
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
