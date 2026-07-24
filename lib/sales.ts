import { readFileSync } from "fs";
import path from "path";

export type Sale = {
  category: string;    // "Suscripción" | "Clase" | "Paquete"
  item: string;        // "Plus" | "Bàsic" | "Pro" | "Pilates Reformer" | ...
  paymentDate: string; // "YYYY-MM-DD"
  serviceDate: string; // "YYYY-MM-DD"
  method: string;      // "Tarjeta" | "urban-sports-club" | "Efectivo"
  amount: number;      // gross (IVA included)
  tax: number;
  email: string | null;
  name: string | null;
};

function parseCSVLine(line: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === "," && !inQ) { cols.push(cur); cur = ""; }
    else { cur += c; }
  }
  cols.push(cur);
  return cols;
}

function toDate(raw: string): string {
  if (!raw) return "";
  return raw.split(",")[0].trim();
}

function normalizeCategory(s: string): string {
  if (s.includes("Suscripci")) return "Suscripción";
  if (s === "Clase") return "Clase";
  if (s === "Paquete") return "Paquete";
  return s;
}

export function normalizeItem(item: string, method: string): string {
  if (method === "urban-sports-club") return "Urban";
  if (/^B[^a-zA-Z]/.test(item) && item.includes("sic")) return "Subs bàsic";
  if (item === "Plus") return "Subs plus";
  if (item === "Pro") return "Subs pro";
  if (item === "Pack Benvinguda") return "Benvinguda 2x1";
  return item;
}

export function loadSales(): Sale[] {
  try {
    const fp = path.join(process.cwd(), "data", "sales.csv");
    const content = readFileSync(fp, "utf-8");
    return content
      .replace(/\r/g, "")
      .split("\n")
      .slice(1)
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        const c = parseCSVLine(line);
        return {
          item: normalizeItem(c[1] ?? "", c[12] ?? ""),
          category: (c[12] ?? "") === "urban-sports-club"
            ? "Urban Sports Club"
            : normalizeCategory(c[0] ?? ""),
          paymentDate: toDate(c[2] ?? ""),
          serviceDate: toDate(c[3] ?? ""),
          method: c[12] ?? "",
          amount: parseFloat(c[13]) || 0,
          tax: parseFloat(c[14]) || 0,
          email: (c[7] || c[9] || "").trim().toLowerCase() || null,
          name: (c[8] || c[10] || "").trim() || null,
        };
      })
      .filter((s) => s.amount > 0 && s.paymentDate.length === 10);
  } catch {
    return [];
  }
}

// ── Analytics ────────────────────────────────────────────────────────────────

const MONTH_LABELS: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

export type MonthlyRevenue = {
  month: string;   // "YYYY-MM"
  label: string;   // "May 2026"
  revenue: number;
  count: number;
};

export function salesByMonth(sales: Sale[]): MonthlyRevenue[] {
  const map = new Map<string, { revenue: number; count: number }>();
  for (const s of sales) {
    const m = s.paymentDate.substring(0, 7);
    const prev = map.get(m) ?? { revenue: 0, count: 0 };
    map.set(m, { revenue: prev.revenue + s.amount, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { revenue, count }]) => {
      const [year, mm] = month.split("-");
      return { month, label: `${MONTH_LABELS[mm] ?? mm} ${year}`, revenue, count };
    });
}

export type MethodRevenue = {
  method: string;
  label: string;
  revenue: number;
  count: number;
};

const METHOD_LABELS: Record<string, string> = {
  "Tarjeta": "Tarjeta",
  "urban-sports-club": "Urban Sports Club",
  "Efectivo": "Efectivo",
};

export function salesByMethod(sales: Sale[]): MethodRevenue[] {
  const map = new Map<string, { revenue: number; count: number }>();
  for (const s of sales) {
    const prev = map.get(s.method) ?? { revenue: 0, count: 0 };
    map.set(s.method, { revenue: prev.revenue + s.amount, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .map(([method, { revenue, count }]) => ({
      method,
      label: METHOD_LABELS[method] ?? method,
      revenue,
      count,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export type ProductRevenue = {
  item: string;
  category: string;
  revenue: number;
  count: number;
};

export function salesByProduct(sales: Sale[]): ProductRevenue[] {
  const map = new Map<string, { category: string; revenue: number; count: number }>();
  for (const s of sales) {
    const prev = map.get(s.item) ?? { category: s.category, revenue: 0, count: 0 };
    map.set(s.item, {
      category: s.category,
      revenue: prev.revenue + s.amount,
      count: prev.count + 1,
    });
  }
  return Array.from(map.entries())
    .map(([item, { category, revenue, count }]) => ({ item, category, revenue, count }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function filterSalesByDate(
  sales: Sale[],
  from?: string | null,
  to?: string | null,
): Sale[] {
  return sales.filter((s) => {
    if (from && s.paymentDate < from) return false;
    if (to   && s.paymentDate > to)   return false;
    return true;
  });
}

export function totalSalesRevenue(sales: Sale[]): number {
  return sales.reduce((sum, s) => sum + s.amount, 0);
}

export function revenueForMonth(sales: Sale[], month: string): number {
  return sales
    .filter((s) => s.paymentDate.startsWith(month))
    .reduce((sum, s) => sum + s.amount, 0);
}

// ── Conversión Pack Benvinguda 2x1 → Suscripción ────────────────────────────

export type ConversionBuyer = {
  email: string;
  name: string | null;
  packDate: string;
  converted: boolean;            // compró una Suscripción después
  convertedDate: string | null;
  daysToConvert: number | null;   // convertedDate - packDate, en días
  boughtOtherPack: boolean;       // compró otro pack de clases (no suscripción) después, sin suscribirse
  otherPackDate: string | null;
};

export type ConversionCohort = {
  month: string;   // "YYYY-MM" del mes de compra del pack
  label: string;   // "Feb 2026"
  buyers: number;
  converted: number;
  rate: number;     // 0..1
  avgDaysToConvert: number | null;
  buyersDetail: ConversionBuyer[];
};

export type ConversionSummary = {
  totalBuyers: number;
  totalConverted: number;
  rate: number;
  avgDaysToConvert: number | null;   // media global, solo de quienes convirtieron a suscripción
  medianDaysToConvert: number | null;
  cohorts: ConversionCohort[];
};

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86_400_000);
}

export function benvingudaConversion(sales: Sale[]): ConversionSummary {
  const packSales = sales.filter((s) => s.item === "Benvinguda 2x1" && s.email);

  const firstPackDate = new Map<string, string>();
  const nameByEmail = new Map<string, string | null>();
  for (const s of packSales) {
    const prev = firstPackDate.get(s.email!);
    if (!prev || s.paymentDate < prev) {
      firstPackDate.set(s.email!, s.paymentDate);
      nameByEmail.set(s.email!, s.name);
    }
  }

  // Separamos suscripciones (lo único que cuenta como "conversión") de otros packs de
  // clases (Pack 4/8, Clase suelta) - comprar otro pack sin suscribirse NO es conversión,
  // pero lo marcamos aparte para no confundirlo con quien no vuelve a comprar nada.
  const subDatesByEmail = new Map<string, string[]>();
  const otherPackDatesByEmail = new Map<string, string[]>();
  for (const s of sales) {
    if (s.item === "Benvinguda 2x1" || !s.email) continue;
    if (s.category === "Suscripción") {
      const arr = subDatesByEmail.get(s.email) ?? [];
      arr.push(s.paymentDate);
      subDatesByEmail.set(s.email, arr);
    } else if (s.category === "Paquete") {
      const arr = otherPackDatesByEmail.get(s.email) ?? [];
      arr.push(s.paymentDate);
      otherPackDatesByEmail.set(s.email, arr);
    }
  }

  const byMonth = new Map<string, ConversionBuyer[]>();
  for (const [email, packDate] of firstPackDate) {
    const month = packDate.slice(0, 7);
    const list = byMonth.get(month) ?? [];
    const subDates = (subDatesByEmail.get(email) ?? []).filter((d) => d > packDate).sort();
    const otherPackDates = (otherPackDatesByEmail.get(email) ?? []).filter((d) => d > packDate).sort();
    const convertedDate = subDates[0] ?? null;
    list.push({
      email,
      name: nameByEmail.get(email) ?? null,
      packDate,
      converted: convertedDate !== null,
      convertedDate,
      daysToConvert: convertedDate ? daysBetween(packDate, convertedDate) : null,
      boughtOtherPack: convertedDate === null && otherPackDates.length > 0,
      otherPackDate: convertedDate === null ? (otherPackDates[0] ?? null) : null,
    });
    byMonth.set(month, list);
  }

  const cohorts = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, buyersDetail]) => {
      const [y, mm] = month.split("-");
      const converted = buyersDetail.filter((b) => b.converted).length;
      const days = buyersDetail.filter((b) => b.daysToConvert !== null).map((b) => b.daysToConvert!);
      return {
        month,
        label: `${MONTH_LABELS[mm] ?? mm} ${y}`,
        buyers: buyersDetail.length,
        converted,
        rate: buyersDetail.length > 0 ? converted / buyersDetail.length : 0,
        avgDaysToConvert: days.length > 0 ? days.reduce((a, b) => a + b, 0) / days.length : null,
        buyersDetail,
      };
    });

  const totalBuyers = firstPackDate.size;
  const totalConverted = cohorts.reduce((s, c) => s + c.converted, 0);
  const allDays = cohorts.flatMap((c) => c.buyersDetail.filter((b) => b.daysToConvert !== null).map((b) => b.daysToConvert!)).sort((a, b) => a - b);
  const avgDaysToConvert = allDays.length > 0 ? allDays.reduce((a, b) => a + b, 0) / allDays.length : null;
  const medianDaysToConvert = allDays.length > 0 ? allDays[Math.floor(allDays.length / 2)] : null;

  return {
    totalBuyers,
    totalConverted,
    rate: totalBuyers > 0 ? totalConverted / totalBuyers : 0,
    avgDaysToConvert,
    medianDaysToConvert,
    cohorts,
  };
}

// ── ¿De dónde vienen los suscriptores? (primera compra) ─────────────────────

export type FirstPurchaseRow = {
  item: string;
  count: number;
  rate: number; // 0..1, sobre el total de suscriptores
};

export type FirstPurchaseSummary = {
  totalSubscribers: number;
  rows: FirstPurchaseRow[];
};

// De todos los clientes que alguna vez se suscribieron, ¿cuál fue su primera compra
// (cualquier producto, ordenado por fecha)? Responde directamente "¿vienen del pack
// 2x1, de una clase suelta, o se suscriben directamente sin probar nada antes?".
export function subscriberFirstPurchase(sales: Sale[]): FirstPurchaseSummary {
  const byEmail = new Map<string, Sale[]>();
  for (const s of sales) {
    if (!s.email) continue;
    const arr = byEmail.get(s.email) ?? [];
    arr.push(s);
    byEmail.set(s.email, arr);
  }

  const counts = new Map<string, number>();
  let totalSubscribers = 0;
  for (const purchases of byEmail.values()) {
    if (!purchases.some((p) => p.category === "Suscripción")) continue;
    totalSubscribers++;
    const firstItem = [...purchases].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))[0].item;
    counts.set(firstItem, (counts.get(firstItem) ?? 0) + 1);
  }

  const rows = Array.from(counts.entries())
    .map(([item, count]) => ({ item, count, rate: totalSubscribers > 0 ? count / totalSubscribers : 0 }))
    .sort((a, b) => b.count - a.count);

  return { totalSubscribers, rows };
}
