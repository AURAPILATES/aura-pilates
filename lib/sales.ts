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

function normalizeItem(s: string): string {
  // "BÃƒÆ'Ã‚Â sic" → "Bàsic" (encoding garble from double-UTF8)
  if (/^B[^a-zA-Z]/.test(s) && s.includes("sic")) return "Bàsic";
  return s;
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
          category: normalizeCategory(c[0] ?? ""),
          item: normalizeItem(c[1] ?? ""),
          paymentDate: toDate(c[2] ?? ""),
          serviceDate: toDate(c[3] ?? ""),
          method: c[12] ?? "",
          amount: parseFloat(c[13]) || 0,
          tax: parseFloat(c[14]) || 0,
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

export function totalSalesRevenue(sales: Sale[]): number {
  return sales.reduce((sum, s) => sum + s.amount, 0);
}

export function revenueForMonth(sales: Sale[], month: string): number {
  return sales
    .filter((s) => s.paymentDate.startsWith(month))
    .reduce((sum, s) => sum + s.amount, 0);
}
