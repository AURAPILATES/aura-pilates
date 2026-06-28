import type { Sale } from "@/lib/sales";
import type { MonthlyProductRevenue } from "@/lib/productRevenue";
import type { MonthlySubStats } from "@/lib/subscriptionCohort";
import type { GroupTotal } from "../GastosResumenGeneral";

export const MONTH_NAMES: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

export const PROCEDENCIA_COLORS: Record<string, string> = { "Interna": "#6B7ED6", "Urban": "#D4AA35" };
export const PRODUCT_COLORS = ["#6B7ED6", "#9260B8", "#D4AA35", "#4A7A9B", "#4A9870", "#D46055", "#C46890", "#3AA09C"];

export function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

export function buildSeries(sales: Sale[], getKey: (s: Sale) => string) {
  const months = [...new Set(sales.map((s) => s.paymentDate.slice(0, 7)))].sort();
  const data = new Map<string, Map<string, number>>();
  for (const s of sales) {
    const m = s.paymentDate.slice(0, 7);
    const k = getKey(s);
    if (!data.has(m)) data.set(m, new Map());
    const row = data.get(m)!;
    row.set(k, (row.get(k) ?? 0) + s.amount);
  }
  return { months, data };
}

export function buildSeriesFromMonthly(monthly: MonthlyProductRevenue[]) {
  const months = monthly.map((m) => m.month);
  const data = new Map<string, Map<string, number>>();
  for (const m of monthly) {
    const row = new Map<string, number>();
    for (const item of m.items) row.set(item.name, item.revenue);
    data.set(m.month, row);
  }
  return { months, data };
}

export function buildSeriesFromProcedencia(monthly: MonthlyProductRevenue[]) {
  const months = monthly.map((m) => m.month);
  const data = new Map<string, Map<string, number>>();
  for (const m of monthly) {
    const urban = m.items.find((i) => i.name === "Urban")?.revenue ?? 0;
    const interna = m.total - urban;
    const row = new Map<string, number>();
    if (interna > 0) row.set("Interna", interna);
    if (urban > 0) row.set("Urban", urban);
    data.set(m.month, row);
  }
  return { months, data };
}

export function buildGroupSeries(groups: GroupTotal[]) {
  const data = new Map<string, Map<string, number>>();
  for (const g of groups) {
    for (const t of g.txns) {
      const m = t.date.slice(0, 7);
      if (!data.has(m)) data.set(m, new Map());
      const row = data.get(m)!;
      row.set(g.group, (row.get(g.group) ?? 0) + Math.abs(t.amount));
    }
  }
  const months = [...data.keys()].sort();
  return { months, data };
}

export type Period = "mes" | "trimestre" | "año";

export function periodKey(month: string, period: Period): string {
  const [y, m] = month.split("-");
  if (period === "mes") return month;
  if (period === "trimestre") return `${y}-Q${Math.ceil(parseInt(m) / 3)}`;
  return y;
}

export function periodLabel(key: string, period: Period): string {
  if (period === "mes") {
    const [y, m] = key.split("-");
    return `${MONTH_NAMES[m] ?? m}'${y.slice(2)}`;
  }
  if (period === "trimestre") return key.replace("-", " ");
  return key;
}

/** Reagrupa una serie mensual (suma de valores) al período pedido. */
export function regroupSeries(
  months: string[],
  data: Map<string, Map<string, number>>,
  period: Period,
): { months: string[]; data: Map<string, Map<string, number>> } {
  if (period === "mes") return { months, data };
  const grouped = new Map<string, Map<string, number>>();
  for (const m of months) {
    const k = periodKey(m, period);
    const src = data.get(m);
    if (!src) continue;
    const dst = grouped.get(k) ?? new Map<string, number>();
    for (const [name, val] of src) dst.set(name, (dst.get(name) ?? 0) + val);
    grouped.set(k, dst);
  }
  const keys = [...grouped.keys()].sort();
  return { months: keys, data: grouped };
}

/** Reagrupa las cohortes de suscripción al período pedido: los flujos (altas/bajas/
 * reactivaciones/ingresos) se suman, "activeCount" toma el valor del último mes del período
 * (es una foto, no un flujo). */
export function regroupCohorts(cohorts: MonthlySubStats[], period: Period): MonthlySubStats[] {
  if (period === "mes") return cohorts;
  const byKey = new Map<string, MonthlySubStats & { lastMonth: string }>();
  for (const c of cohorts) {
    const k = periodKey(c.month, period);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, { ...c, month: k, label: periodLabel(k, period), lastMonth: c.month });
    } else {
      byKey.set(k, {
        ...prev,
        revenue: prev.revenue + c.revenue,
        newSubs: prev.newSubs + c.newSubs,
        churned: prev.churned + c.churned,
        reactivated: prev.reactivated + c.reactivated,
        activeCount: c.month > prev.lastMonth ? c.activeCount : prev.activeCount,
        lastMonth: c.month > prev.lastMonth ? c.month : prev.lastMonth,
      });
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((v) => ({
      month: v.month, label: v.label, revenue: v.revenue,
      activeCount: v.activeCount, newSubs: v.newSubs, churned: v.churned, reactivated: v.reactivated,
    }));
}

export function makeTrendSummary(
  months: string[],
  data: Map<string, Map<string, number>>,
  keys: string[],
): string[] {
  if (months.length < 2) return [];
  const win = Math.min(3, Math.floor(months.length / 2));
  const recent = months.slice(-win);
  const prev = months.slice(-(win * 2), -win);
  if (prev.length === 0) return [];

  const sum = (ms: string[], k: string) => ms.reduce((s, m) => s + (data.get(m)?.get(k) ?? 0), 0);
  const sumAll = (ms: string[]) => keys.reduce((s, k) => s + sum(ms, k), 0);

  const sentences: string[] = [];
  const rTot = sumAll(recent);
  const pTot = sumAll(prev);
  if (pTot > 0) {
    const pct = Math.round(((rTot - pTot) / pTot) * 100);
    const ref = win === 1 ? "el mes anterior" : `los ${win} meses anteriores`;
    if (Math.abs(pct) < 4) sentences.push(`Los ingresos totales se mantienen estables respecto a ${ref}.`);
    else if (pct > 0) sentences.push(`Los ingresos totales han crecido un ${pct}% respecto a ${ref}.`);
    else sentences.push(`Los ingresos totales han bajado un ${Math.abs(pct)}% respecto a ${ref}.`);
  }

  const trends = keys.slice(0, 6).flatMap((k) => {
    const r = sum(recent, k);
    const p = sum(prev, k);
    if (p === 0 || (r === 0 && p === 0)) return [];
    return [{ label: k, pct: Math.round(((r - p) / p) * 100) }];
  });

  const growing = trends.filter((t) => t.pct >= 5).sort((a, b) => b.pct - a.pct);
  const stable = trends.filter((t) => Math.abs(t.pct) < 5);
  const declining = trends.filter((t) => t.pct <= -5).sort((a, b) => a.pct - b.pct);

  if (growing.length > 0) sentences.push(`Suben: ${growing.map((t) => `${t.label} (+${t.pct}%)`).join(", ")}.`);
  if (stable.length > 0) sentences.push(`Se mantienen estables: ${stable.map((t) => t.label).join(", ")}.`);
  if (declining.length > 0) sentences.push(`Bajan: ${declining.map((t) => `${t.label} (${t.pct}%)`).join(", ")}.`);

  return sentences;
}
