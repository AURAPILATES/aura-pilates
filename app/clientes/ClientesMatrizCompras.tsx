"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeText } from "@/lib/normalizeText";
import { drawerNav } from "@/lib/drawerNav";
import type { StripePayment } from "@/lib/stripePayments";
import type { UrbanClientRow } from "@/lib/clientActivityV2";
import type { CustomerRow } from "./ClientesTable";
import CustomerDrawer from "./CustomerDrawer";
import ClientesMatrizComprasV2 from "./ClientesMatrizComprasV2";
import ClientesMatrizProductoV2 from "./ClientesMatrizProductoV2";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";

export const PRODUCT_FILTERS = ["Bàsic", "Plus", "Pro", "Pack 4 clases", "Pack 8 clases", "Pack Benvinguda", "Clase suelta"];
// Filas del resumen "por producto": los productos conocidos + "Otro" (pagos que no casan con
// ningún precio, p.ej. con cupón) + "Urban" (asistencia, no pago individual - ver productRows).
const PRODUCT_ROWS = [...PRODUCT_FILTERS, "Otro", "Urban"];

const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS_ES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export function productAbbr(product: string): string {
  if (product === "Bàsic")            return "Bàsic";
  if (product === "Plus")             return "Plus";
  if (product === "Pro")              return "Pro";
  if (product === "Pack 4 clases")    return "Pack 4";
  if (product === "Pack 8 clases")    return "Pack 8";
  if (product === "Pack Benvinguda")  return "Benvinguda";
  if (product === "Clase suelta")     return "Suelta";
  return "Otro";
}

export function productColor(product: string): string {
  if (product === "Bàsic" || product === "Plus" || product === "Pro")
    return "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400";
  if (product === "Pack Benvinguda")
    return "bg-pink-50 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400";
  if (product === "Pack 4 clases" || product === "Pack 8 clases")
    return "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400";
  if (product === "Clase suelta")
    return "bg-yellow-50 dark:bg-yellow-500/15 text-yellow-600 dark:text-yellow-400";
  return "bg-navy/[0.05] text-navy/50";
}

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
  urbanClients: UrbanClientRow[];
};

export type MatrixRow = {
  customer: CustomerRow;
  byMonth: Record<string, Array<{ product: string; amount: number }>>;
  totalPaid: number;
  products: Set<string>;
  firstPurchase: string | null;
  isUpsellCandidate: boolean;
  purchaseCount: number;
};

// Fila del resumen "por producto" (a diferencia de MatrixRow, que es por cliente): cuántos
// alumnos distintos y cuánto ingresó cada producto cada mes - Urban incluido, aunque su
// "importe" venga de la tarifa estimada (lib/clientActivityV2.ts) y no de un cobro Stripe real.
export type ProductRow = {
  product: string;
  byMonth: Record<string, { count: number; amount: number }>;
  totalCount: number;
  totalAmount: number;
};

export const PURCHASE_COUNT_FILTERS = ["1", "2", "3", "4", "5+"];

export type SortKey = "name" | "total" | "first";
type View = "cliente" | "producto";
const PAGE_SIZE = 100;

export default function ClientesMatrizCompras({ customers, payments, urbanClients }: Props) {
  const [view, setView] = useState<View>("cliente");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [productFilter, setProductFilter] = useState<string>("");
  const [firstPurchaseFilter, setFirstPurchaseFilter] = useState<string>("");
  const [purchaseCountFilter, setPurchaseCountFilter] = useState<string>("");
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [onlyUpsell, setOnlyUpsell] = useState(false);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [page, setPage] = useState(0);

  const { months, matrix } = useMemo(() => {
    const now = new Date();
    const start = new Date(2026, 1, 1); // Feb 2026 - apertura
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
      let purchaseCount = 0;
      const products = new Set<string>();
      for (const p of payments) {
        if (!p.customerId || !c.stripeIds.includes(p.customerId)) continue;
        const m = p.date.slice(0, 7);
        if (!byMonth[m]) byMonth[m] = [];
        byMonth[m].push({ product: p.inferredProduct, amount: p.amount });
        totalPaid += p.amount;
        purchaseCount += 1;
        products.add(p.inferredProduct);
        if (!firstPurchase || p.date < firstPurchase) firstPurchase = p.date;
      }
      const monthsPurchased = Object.keys(byMonth).length;
      const isUpsellCandidate =
        products.has("Bàsic") && !products.has("Plus") && !products.has("Pro") && monthsPurchased >= 3;
      return { customer: c, byMonth, totalPaid, products, firstPurchase, isUpsellCandidate, purchaseCount };
    });

    return { months, matrix };
  }, [customers, payments]);

  const lastMonth = months[months.length - 1];

  // Resumen "por producto": agrupa directamente los pagos de Stripe (Bàsic/Plus/Pro/Packs) más
  // la matriz de Urban ya calculada aparte (Urban no cobra por Stripe, así que su "importe" sale
  // de la tarifa estimada de lib/clientActivityV2.ts, no de un pago real por alumno).
  // "Otro" recoge cualquier pago que no case con ningún precio conocido (p.ej. con cupón) - sin
  // esto esos pagos desaparecían sin dejar rastro y la suma de la tabla no cuadraba con el
  // ingreso real de Stripe del periodo.
  const productRows = useMemo(() => {
    const byProductMonth = new Map<string, Map<string, { customers: Set<string>; amount: number }>>();
    // Alumnos DISTINTOS del producto en todo el periodo, no la suma de los recuentos mensuales -
    // sumar meses cuenta varias veces a quien repite (lo habitual en una suscripción mensual).
    const byProductTotal = new Map<string, Set<string>>();
    function bucket(product: string, month: string) {
      if (!byProductMonth.has(product)) byProductMonth.set(product, new Map());
      const byMonth = byProductMonth.get(product)!;
      if (!byMonth.has(month)) byMonth.set(month, { customers: new Set(), amount: 0 });
      return byMonth.get(month)!;
    }
    function addCustomer(product: string, month: string, customerId: string) {
      bucket(product, month).customers.add(customerId);
      if (!byProductTotal.has(product)) byProductTotal.set(product, new Set());
      byProductTotal.get(product)!.add(customerId);
    }
    for (const p of payments) {
      const product = PRODUCT_FILTERS.includes(p.inferredProduct) ? p.inferredProduct : "Otro";
      const month = p.date.slice(0, 7);
      bucket(product, month).amount += p.amount;
      if (p.customerId) addCustomer(product, month, p.customerId);
    }
    for (const r of urbanClients) {
      for (const [month, act] of Object.entries(r.byMonth)) {
        if (!act.classes) continue;
        bucket("Urban", month).amount += act.estimated;
        addCustomer("Urban", month, String(r.memberId));
      }
    }
    return PRODUCT_ROWS.map((product) => {
      const byMonthSrc = byProductMonth.get(product);
      const byMonth: Record<string, { count: number; amount: number }> = {};
      let totalAmount = 0;
      for (const m of months) {
        const cell = byMonthSrc?.get(m);
        const count = cell?.customers.size ?? 0;
        const amount = cell?.amount ?? 0;
        byMonth[m] = { count, amount };
        totalAmount += amount;
      }
      const totalCount = byProductTotal.get(product)?.size ?? 0;
      return { product, byMonth, totalCount, totalAmount };
    });
  }, [payments, urbanClients, months]);

  function downloadProductCsv() {
    const header = ["Producto", ...months.map((m) => `${monthLabel(m)} (alumnos)`), ...months.map((m) => `${monthLabel(m)} (€)`), "Total alumnos", "Total €"];
    const rows = productRows.map((r) => [
      r.product,
      ...months.map((m) => String(r.byMonth[m].count)),
      ...months.map((m) => r.byMonth[m].amount.toFixed(2)),
      String(r.totalCount),
      r.totalAmount.toFixed(2),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compras-por-producto-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const visibleMatrix = useMemo(() => {
    const q = normalizeText(search).trim();
    let rows = matrix.filter(({ customer, products, byMonth, firstPurchase, isUpsellCandidate, purchaseCount }) => {
      if (q) {
        const label = normalizeText(customer.name ?? customer.email ?? "");
        if (!label.includes(q)) return false;
      }
      if (productFilter && !products.has(productFilter)) return false;
      if (firstPurchaseFilter && firstPurchase?.slice(0, 7) !== firstPurchaseFilter) return false;
      if (purchaseCountFilter) {
        if (purchaseCountFilter === "5+" ? purchaseCount < 5 : purchaseCount !== Number(purchaseCountFilter)) return false;
      }
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
  }, [matrix, search, sortKey, sortDir, productFilter, firstPurchaseFilter, purchaseCountFilter, onlyInactive, onlyUpsell, lastMonth]);

  useEffect(() => {
    setPage(0);
  }, [search, sortKey, sortDir, productFilter, firstPurchaseFilter, purchaseCountFilter, onlyInactive, onlyUpsell]);

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
    const header = ["Cliente", "Email", "Primera compra", "Nº compras", ...months.map(monthLabel), "Total"];
    const rows = visibleMatrix.map(({ customer, byMonth, totalPaid, firstPurchase, purchaseCount }) => [
      customer.name ?? "",
      customer.email ?? "",
      firstPurchase ?? "",
      String(purchaseCount),
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

  if (matrix.length === 0 && urbanClients.length === 0) return null;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "total" ? "desc" : "asc");
    }
  }

  return (
    <div className="flex flex-col items-center w-full">
      <div className="self-start mb-3">
        <FilterPillGroupV2
          variant="segmented"
          active={view}
          onChange={setView}
          options={[
            { key: "cliente", label: "Por cliente" },
            { key: "producto", label: "Por producto" },
          ]}
        />
      </div>

      {view === "producto" ? (
        <ClientesMatrizProductoV2 months={months} rows={productRows} onExportCsv={downloadProductCsv} />
      ) : (
        <ClientesMatrizComprasV2
          search={search}
          onSearchChange={setSearch}
          productFilter={productFilter}
          onProductFilterChange={setProductFilter}
          firstPurchaseFilter={firstPurchaseFilter}
          onFirstPurchaseFilterChange={setFirstPurchaseFilter}
          purchaseCountFilter={purchaseCountFilter}
          onPurchaseCountFilterChange={setPurchaseCountFilter}
          onlyInactive={onlyInactive}
          onToggleOnlyInactive={() => setOnlyInactive((v) => !v)}
          onlyUpsell={onlyUpsell}
          onToggleOnlyUpsell={() => setOnlyUpsell((v) => !v)}
          lastMonth={lastMonth}
          months={months}
          rows={pageRows}
          sortKey={sortKey}
          sortDir={sortDir}
          onToggleSort={toggleSort}
          monthTotals={monthTotals}
          grandTotal={grandTotal}
          totalCount={visibleMatrix.length}
          page={safePage}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          onRowClick={setSelected}
          onExportCsv={downloadCsv}
        />
      )}
      {selected && (() => {
        const { prev, next } = drawerNav(visibleMatrix.map((r) => r.customer), selected.id, (c) => c.id);
        return (
          <CustomerDrawer
            key={selected.id}
            customer={selected}
            payments={payments}
            onClose={() => setSelected(null)}
            onPrev={prev ? () => setSelected(prev) : undefined}
            onNext={next ? () => setSelected(next) : undefined}
            hasPrev={!!prev}
            hasNext={!!next}
          />
        );
      })()}
    </div>
  );
}
