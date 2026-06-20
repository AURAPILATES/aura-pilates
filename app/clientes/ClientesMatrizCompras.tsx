"use client";

import { useMemo, useState } from "react";
import type { StripePayment } from "@/lib/stripePayments";
import type { CustomerRow } from "./ClientesTable";
import { fmt } from "@/lib/analytics";

const PRODUCT_FILTERS = ["Bàsic", "Plus", "Pro", "Pack 4 clases", "Pack 8 clases", "Pack Benvinguda", "Clase suelta"];

const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS_ES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function productAbbr(product: string): string {
  if (product === "Bàsic")            return "Bàsic";
  if (product === "Plus")             return "Plus";
  if (product === "Pro")              return "Pro";
  if (product === "Pack 4 clases")    return "Pack 4";
  if (product === "Pack 8 clases")    return "Pack 8";
  if (product === "Pack Benvinguda")  return "Benvinguda";
  if (product === "Clase suelta")     return "Suelta";
  return "Otro";
}

function productColor(product: string): string {
  if (product === "Bàsic" || product === "Plus" || product === "Pro")
    return "bg-violet-50 text-violet-600";
  if (product === "Pack Benvinguda")
    return "bg-pink-50 text-pink-600";
  if (product === "Pack 4 clases" || product === "Pack 8 clases")
    return "bg-orange-50 text-orange-600";
  if (product === "Clase suelta")
    return "bg-yellow-50 text-yellow-600";
  return "bg-navy/[0.05] text-navy/50";
}

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
};

type SortKey = "name" | "total" | "first";

export default function ClientesMatrizCompras({ customers, payments }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [productFilter, setProductFilter] = useState<string>("");
  const [onlyInactive, setOnlyInactive] = useState(false);

  const { months, matrix } = useMemo(() => {
    const now = new Date();
    const start = new Date(2026, 1, 1); // Feb 2026 — apertura
    const months: string[] = [];
    const cur = new Date(start);
    while (cur <= now) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }

    const matrix = customers.map((c) => {
      const byMonth: Record<string, Array<{ product: string; amount: number }>> = {};
      let totalPaid = 0;
      let firstPurchase: string | null = null;
      const products = new Set<string>();
      for (const p of payments) {
        if (!p.customerId || !c.stripeIds.includes(p.customerId)) continue;
        const m = p.date.slice(0, 7);
        if (!byMonth[m]) byMonth[m] = [];
        byMonth[m].push({ product: p.inferredProduct, amount: p.amount });
        totalPaid += p.amount;
        products.add(p.inferredProduct);
        if (!firstPurchase || p.date < firstPurchase) firstPurchase = p.date;
      }
      return { customer: c, byMonth, totalPaid, products, firstPurchase };
    });

    return { months, matrix };
  }, [customers, payments]);

  const lastMonth = months[months.length - 1];

  const visibleMatrix = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = matrix.filter(({ customer, products, byMonth }) => {
      if (q) {
        const label = (customer.name ?? customer.email ?? "").toLowerCase();
        if (!label.includes(q)) return false;
      }
      if (productFilter && !products.has(productFilter)) return false;
      if (onlyInactive && byMonth[lastMonth]?.length) return false;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sortKey === "first") {
        if (!a.firstPurchase && !b.firstPurchase) return 0;
        if (!a.firstPurchase) return 1;
        if (!b.firstPurchase) return -1;
        const cmp = a.firstPurchase.localeCompare(b.firstPurchase);
        return sortDir === "asc" ? cmp : -cmp;
      }
      let cmp = 0;
      if (sortKey === "name") {
        cmp = (a.customer.name ?? a.customer.email ?? "").localeCompare(
          b.customer.name ?? b.customer.email ?? "",
          "es",
        );
      } else {
        cmp = a.totalPaid - b.totalPaid;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [matrix, search, sortKey, sortDir, productFilter, onlyInactive, lastMonth]);

  if (matrix.length === 0) return null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "total" ? "desc" : "asc");
    }
  }

  function sortArrow(key: SortKey) {
    return sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";
  }

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5 mb-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-navy">Compras por cliente y mes</h3>
          <p className="text-xs text-navy/45 mt-0.5">
            Todas las compras registradas · cada celda muestra el producto y el importe
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className="text-xs px-3 py-1.5 rounded-lg border border-navy/[0.1] bg-navy/[0.02] text-navy placeholder:text-navy/35 focus:outline-none focus:ring-1 focus:ring-navy/20 min-w-[160px]"
          />
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-navy/[0.1] bg-navy/[0.02] text-navy focus:outline-none focus:ring-1 focus:ring-navy/20"
          >
            <option value="">Todos los productos</option>
            {PRODUCT_FILTERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setOnlyInactive((v) => !v)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
              onlyInactive
                ? "border-navy/20 bg-navy/[0.08] text-navy font-medium"
                : "border-navy/[0.1] bg-navy/[0.02] text-navy/60"
            }`}
          >
            Sin compra en {lastMonth ? monthLabel(lastMonth) : "el último mes"}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs" style={{ tableLayout: "auto", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr className="border-b border-navy/[0.06]">
              <th
                onClick={() => toggleSort("name")}
                className="sticky left-0 bg-white text-left pb-2 pr-3 text-[11px] font-semibold text-navy/40 uppercase tracking-wider whitespace-nowrap z-10 min-w-[130px] cursor-pointer select-none hover:text-navy/60"
              >
                Cliente{sortArrow("name")}
              </th>
              <th
                onClick={() => toggleSort("first")}
                className="sticky left-[130px] bg-white text-center pb-2 px-1 text-[11px] font-semibold text-navy/40 uppercase tracking-wider whitespace-nowrap z-10 min-w-[90px] cursor-pointer select-none hover:text-navy/60"
              >
                Primera compra{sortArrow("first")}
              </th>
              {months.map((m) => (
                <th key={m} className="text-center pb-2 px-1 text-[11px] font-semibold text-navy/40 uppercase tracking-wider whitespace-nowrap min-w-[76px]">
                  {monthLabel(m)}
                </th>
              ))}
              <th
                onClick={() => toggleSort("total")}
                className="sticky right-0 bg-white text-right pb-2 pl-4 pr-1 text-[11px] font-semibold text-navy/40 uppercase tracking-wider whitespace-nowrap z-20 min-w-[72px] cursor-pointer select-none hover:text-navy/60 border-l border-navy/[0.06]"
              >
                Total{sortArrow("total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleMatrix.length === 0 && (
              <tr>
                <td colSpan={months.length + 3} className="py-6 text-center text-navy/40">
                  Sin resultados
                </td>
              </tr>
            )}
            {visibleMatrix.map(({ customer, byMonth, totalPaid, firstPurchase }) => (
              <tr key={customer.id} className="border-b border-navy/[0.04] last:border-0 hover:bg-navy/[0.015] transition-colors">
                <td className="sticky left-0 bg-white py-2 pr-3 font-medium text-navy whitespace-nowrap z-10 max-w-[130px] truncate" title={customer.name ?? customer.email ?? undefined}>
                  {customer.name ?? customer.email ?? "—"}
                </td>
                <td className="sticky left-[130px] bg-white py-2 px-1 text-center text-navy/60 whitespace-nowrap z-10">
                  {firstPurchase ? monthLabel(firstPurchase.slice(0, 7)) : "—"}
                </td>
                {months.map((m) => {
                  const purchases = byMonth[m];
                  if (!purchases || purchases.length === 0) {
                    return <td key={m} className="py-1.5 px-1 text-center" />;
                  }
                  const products = [...new Map(purchases.map((p) => [p.product, p])).keys()];
                  const total = purchases.reduce((s, p) => s + p.amount, 0);
                  const colorCls = productColor(products[0]);
                  return (
                    <td key={m} className="py-1.5 px-1 text-center">
                      <div className={`rounded-lg px-1.5 py-1 flex flex-col items-center gap-0.5 ${colorCls} min-w-[68px]`}>
                        {products.map((prod) => (
                          <span key={prod} className="text-[10px] font-semibold leading-tight">
                            {productAbbr(prod)}
                          </span>
                        ))}
                        <span className="text-[9px] opacity-60 leading-tight font-medium">
                          {fmt(total)}
                        </span>
                      </div>
                    </td>
                  );
                })}
                <td className="sticky right-0 bg-white py-2 pl-4 pr-1 text-right whitespace-nowrap z-20 border-l border-navy/[0.06]">
                  <span className="text-[11px] font-semibold text-navy tabular-nums">{fmt(totalPaid)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
