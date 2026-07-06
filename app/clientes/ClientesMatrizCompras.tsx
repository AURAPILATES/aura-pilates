"use client";

import { useEffect, useMemo, useState } from "react";
import type { StripePayment } from "@/lib/stripePayments";
import type { CustomerRow } from "./ClientesTable";
import CustomerDrawer from "./CustomerDrawer";
import SearchInput from "@/app/components/SearchInput";
import TablePagination from "@/app/components/TablePagination";
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
const PAGE_SIZE = 30;

export default function ClientesMatrizCompras({ customers, payments }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [productFilter, setProductFilter] = useState<string>("");
  const [firstPurchaseFilter, setFirstPurchaseFilter] = useState<string>("");
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [onlyUpsell, setOnlyUpsell] = useState(false);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [page, setPage] = useState(0);

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
      const monthsPurchased = Object.keys(byMonth).length;
      const isUpsellCandidate =
        products.has("Bàsic") && !products.has("Plus") && !products.has("Pro") && monthsPurchased >= 3;
      return { customer: c, byMonth, totalPaid, products, firstPurchase, isUpsellCandidate };
    });

    return { months, matrix };
  }, [customers, payments]);

  const lastMonth = months[months.length - 1];

  const visibleMatrix = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = matrix.filter(({ customer, products, byMonth, firstPurchase, isUpsellCandidate }) => {
      if (q) {
        const label = (customer.name ?? customer.email ?? "").toLowerCase();
        if (!label.includes(q)) return false;
      }
      if (productFilter && !products.has(productFilter)) return false;
      if (firstPurchaseFilter && firstPurchase?.slice(0, 7) !== firstPurchaseFilter) return false;
      if (onlyInactive && byMonth[lastMonth]?.length) return false;
      if (onlyUpsell && !isUpsellCandidate) return false;
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
  }, [matrix, search, sortKey, sortDir, productFilter, firstPurchaseFilter, onlyInactive, onlyUpsell, lastMonth]);

  useEffect(() => {
    setPage(0);
  }, [search, sortKey, sortDir, productFilter, firstPurchaseFilter, onlyInactive, onlyUpsell]);

  const totalPages = Math.max(1, Math.ceil(visibleMatrix.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = visibleMatrix.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const monthTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const m of months) {
      totals[m] = visibleMatrix.reduce((sum, row) => sum + (row.byMonth[m]?.reduce((s, p) => s + p.amount, 0) ?? 0), 0);
    }
    return totals;
  }, [visibleMatrix, months]);

  const grandTotal = useMemo(() => visibleMatrix.reduce((sum, row) => sum + row.totalPaid, 0), [visibleMatrix]);

  function downloadCsv() {
    const header = ["Cliente", "Email", "Primera compra", ...months.map(monthLabel), "Total"];
    const rows = visibleMatrix.map(({ customer, byMonth, totalPaid, firstPurchase }) => [
      customer.name ?? "",
      customer.email ?? "",
      firstPurchase ?? "",
      ...months.map((m) => (byMonth[m]?.reduce((s, p) => s + p.amount, 0) ?? 0).toFixed(2)),
      totalPaid.toFixed(2),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compras-por-cliente-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar cliente…" className="w-44" />
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-xl border border-navy/[0.12] bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
          >
            <option value="">Todos los productos</option>
            {PRODUCT_FILTERS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={firstPurchaseFilter}
            onChange={(e) => setFirstPurchaseFilter(e.target.value)}
            className="text-sm px-3 py-2 rounded-xl border border-navy/[0.12] bg-white text-navy focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
          >
            <option value="">Primera compra: todas</option>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setOnlyInactive((v) => !v)}
            className={`text-sm px-3 py-2 rounded-xl border whitespace-nowrap transition-colors ${
              onlyInactive
                ? "border-primary/40 bg-primary/5 text-primary font-medium"
                : "border-navy/[0.12] bg-white text-navy/60 hover:bg-navy/[0.02]"
            }`}
          >
            Sin compra en {lastMonth ? monthLabel(lastMonth) : "el último mes"}
          </button>
          <button
            type="button"
            onClick={() => setOnlyUpsell((v) => !v)}
            title="Clientes en Bàsic desde hace 3 meses o más que nunca han subido a Plus o Pro"
            className={`text-sm px-3 py-2 rounded-xl border whitespace-nowrap transition-colors ${
              onlyUpsell
                ? "border-primary/40 bg-primary/5 text-primary font-medium"
                : "border-navy/[0.12] bg-white text-navy/60 hover:bg-navy/[0.02]"
            }`}
          >
            Candidatos a upsell
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            title="Exportar vista actual a CSV"
            className="shrink-0 flex items-center justify-center w-9 h-9 text-navy/50 hover:text-navy border border-navy/[0.12] rounded-xl bg-white hover:bg-navy/[0.02] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs w-full" style={{ tableLayout: "fixed", borderCollapse: "separate", borderSpacing: 0 }}>
          <colgroup>
            <col style={{ width: 130 }} />
            <col style={{ width: 110 }} />
            {months.map((m) => (
              <col key={m} style={{ width: 76 }} />
            ))}
            <col />
          </colgroup>
          <thead>
            <tr className="bg-navy/[0.02] border-b border-navy/[0.06]">
              <th
                onClick={() => toggleSort("name")}
                className="sticky left-0 bg-[#fafaf9] text-left pt-2.5 pb-2 pr-3 text-[11px] font-semibold text-navy/45 uppercase tracking-wider whitespace-nowrap z-10 min-w-[130px] cursor-pointer select-none hover:text-navy/60"
              >
                Cliente{sortArrow("name")}
              </th>
              <th
                onClick={() => toggleSort("first")}
                className="sticky left-[130px] bg-[#fafaf9] text-center pt-2.5 pb-2 px-1 text-[10px] leading-tight font-semibold text-navy/45 uppercase tracking-wide z-10 min-w-[110px] cursor-pointer select-none hover:text-navy/60"
              >
                Primera<br />compra{sortArrow("first")}
              </th>
              {months.map((m) => (
                <th key={m} className="text-center pt-2.5 pb-2 px-1 text-[11px] font-semibold text-navy/45 uppercase tracking-wider whitespace-nowrap min-w-[76px]">
                  {monthLabel(m)}
                </th>
              ))}
              <th
                onClick={() => toggleSort("total")}
                className="sticky right-0 bg-[#fafaf9] text-right pt-2.5 pb-2 pr-4 text-[11px] font-semibold text-navy/45 uppercase tracking-wider whitespace-nowrap z-10 cursor-pointer select-none hover:text-navy/60"
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
            {pageRows.map(({ customer, byMonth, totalPaid, firstPurchase }) => {
              return (
                <tr
                  key={customer.id}
                  onClick={() => setSelected(customer)}
                  className="border-b border-navy/[0.04] last:border-0 hover:bg-navy/[0.02] transition-colors cursor-pointer"
                >
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
                  <td className="sticky right-0 bg-white py-2 pr-4 text-right whitespace-nowrap z-10">
                    <span className="text-[11px] font-semibold text-navy tabular-nums">{fmt(totalPaid)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {visibleMatrix.length > 0 && (
            <tfoot>
              <tr className="border-t border-navy/[0.08]">
                <td className="sticky left-0 bg-white py-2 pr-3 font-semibold text-navy/70 text-[11px] uppercase tracking-wider z-10">
                  Total
                </td>
                <td className="sticky left-[130px] bg-white z-10" />
                {months.map((m) => (
                  <td key={m} className="py-2 px-1 text-center text-[11px] font-semibold text-navy/70 tabular-nums">
                    {monthTotals[m] > 0 ? fmt(monthTotals[m]) : "—"}
                  </td>
                ))}
                <td className="sticky right-0 bg-white py-2 pr-4 text-right z-10">
                  <span className="text-[11px] font-bold text-navy tabular-nums">{fmt(grandTotal)}</span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="-mx-5 -mb-5 mt-4">
        <TablePagination page={safePage} totalItems={visibleMatrix.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
      {selected && (
        <CustomerDrawer key={selected.id} customer={selected} payments={payments} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
