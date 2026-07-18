"use client";

import { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from "react";
import CustomerDrawer from "./CustomerDrawer";
import ClientesTableV2 from "./ClientesTableV2";
import { productAbbr, PRODUCT_FILTERS } from "./ClientesMatrizCompras";
import type { StripeCustomer } from "@/lib/stripeCustomers";
import type { StripePayment } from "@/lib/stripePayments";

export type CustomerRow = StripeCustomer & { daysSinceLastSub?: number | null; daysSinceLastPack?: number | null; lastPackProduct?: string | null; lastSubProduct?: string | null; isActive?: boolean; isNew?: boolean };
export type ClientesTableHandle = { openCustomer: (id: string) => void };

export type SortKey = "totalSpent" | "lastPaymentDate" | "name";
export type SortDir = "asc" | "desc";
export type Filter  = "all" | "recurring" | "occasional" | "discount" | "error" | "delayed";
const PAGE_SIZE = 25;

export function fmtDate(d: string) {
  return d.split("-").reverse().join("/");
}

export function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr + "T00:00:00").getTime()) / 86400000);
  if (days < 7)   return `Hace ${days} día${days !== 1 ? "s" : ""}`;
  if (days < 30)  return `Hace ${Math.round(days / 7)} semana${Math.round(days / 7) !== 1 ? "s" : ""}`;
  const months = Math.round((days / 30) * 2) / 2;
  if (days < 365) return `Hace ${String(months).replace(".", ",")} mes${months !== 1 ? "es" : ""}`;
  const years = Math.round((days / 365) * 2) / 2;
  return `Hace ${String(years).replace(".", ",")} año${years !== 1 ? "s" : ""}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}


export function paymentExpiry(p: { category: string; inferredProduct: string; date: string }): string | null {
  if (p.category === "Suscripción") return addDays(p.date, 30);
  if (p.inferredProduct === "Pack Benvinguda") return addDays(p.date, 15);
  if (p.inferredProduct === "Pack 4 clases" || p.inferredProduct === "Pack 8 clases") return addDays(p.date, 90);
  return null;
}

export type ClientStatus = "baja" | "sinpagar" | "caducado" | "porvencer" | "ok";

export function clientStatus(c: CustomerRow): { status: ClientStatus; days: number | null } {
  if (c.isRecurring) {
    const d = c.daysSinceLastSub ?? null;
    if (d == null) return { status: "ok", days: null };
    if (d > 45) return { status: "baja",     days: d };
    if (d > 30) return { status: "sinpagar", days: d - 30 };
    return { status: "ok", days: null };
  }
  const d    = c.daysSinceLastPack ?? null;
  const prod = c.lastPackProduct   ?? null;
  if (d != null && prod) {
    if (prod === "Pack Benvinguda") {
      if (d > 15) return { status: "caducado",  days: d - 15 };
      if (d > 12) return { status: "porvencer", days: 15 - d };
      return { status: "ok", days: null };
    }
    if (prod === "Pack 4 clases" || prod === "Pack 8 clases") {
      if (d > 105) return { status: "baja",      days: d - 90 };
      if (d > 90)  return { status: "caducado",  days: d - 90 };
      if (d > 76)  return { status: "porvencer", days: 90 - d };
    }
  }
  return { status: "ok", days: null };
}

export type PlanBadgeCfg = { label: string; cls: string };
export function planBadgeCfg(planType: "sub" | "pack" | "session", lastSubProduct?: string | null, lastPackProduct?: string | null): PlanBadgeCfg {
  if (planType === "sub") {
    if (lastSubProduct === "Bàsic") return { label: "Suscripción Bàsic", cls: "bg-violet-50 text-violet-600" };
    if (lastSubProduct === "Plus")  return { label: "Suscripción Plus",  cls: "bg-indigo-50 text-indigo-600" };
    if (lastSubProduct === "Pro")   return { label: "Suscripción Pro",   cls: "bg-purple-50 text-purple-700" };
    return { label: "Suscripción",                                        cls: "bg-violet-50 text-violet-600" };
  }
  if (planType === "pack") {
    if (lastPackProduct === "Pack 4 clases")   return { label: "Pack 4",       cls: "bg-orange-50 text-orange-600" };
    if (lastPackProduct === "Pack 8 clases")   return { label: "Pack 8",       cls: "bg-orange-100 text-orange-700" };
    if (lastPackProduct === "Pack Benvinguda") return { label: "Pack Benvinguda", cls: "bg-pink-50 text-pink-600" };
    if (lastPackProduct === "Clase suelta")    return { label: "Clase suelta", cls: "bg-yellow-50 text-yellow-600" };
    return { label: "Pack",                                                cls: "bg-orange-50 text-orange-600" };
  }
  return { label: "Por sesión", cls: "bg-navy/[0.06] text-navy/55" };
}

/** Valor de filtro para clientes sin suscripción ni pack en curso (pagan por sesión suelta). */
export const SESSION_PLAN = "__session__";

/** Producto del plan vigente (la suscripción o pack más reciente): el mismo criterio que ya
 * usaba la búsqueda por texto, extraído para reutilizarlo en el filtro "Plan actual". */
export function currentPlanProduct(c: CustomerRow): string {
  const dSub  = c.daysSinceLastSub  ?? Infinity;
  const dPack = c.daysSinceLastPack ?? Infinity;
  const planType = dSub <= dPack && dSub < Infinity ? "sub" : dPack < Infinity ? "pack" : "session";
  if (planType === "sub")  return c.lastSubProduct  ?? SESSION_PLAN;
  if (planType === "pack") return c.lastPackProduct ?? SESSION_PLAN;
  return SESSION_PLAN;
}

export function initials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}


type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
  activeMonth?: string | null;
  onClearMonth?: () => void;
};

const ClientesTable = forwardRef<ClientesTableHandle, Props>(function ClientesTable(
  { customers, payments, activeMonth, onClearMonth },
  ref,
) {
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<Filter>("all");
  const [planFilter, setPlanFilter] = useState("");
  const [sortKey,  setSortKey]  = useState<SortKey>("totalSpent");
  const [sortDir,  setSortDir]  = useState<SortDir>("desc");
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [search, filter, planFilter, activeMonth]);

  useImperativeHandle(ref, () => ({
    openCustomer(id: string) {
      const c = customers.find((c) => c.id === id);
      if (c) setSelected(c);
    },
  }));

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const couponStripeIds = useMemo(
    () => new Set(payments.filter((p) => p.inferredType === "coupon" && p.customerId).map((p) => p.customerId!)),
    [payments],
  );

  const hasDiscount = (c: CustomerRow) => !!c.discount || c.stripeIds.some((sid) => couponStripeIds.has(sid));

  const discountCount = customers.filter(hasDiscount).length;
  const errorCount    = customers.filter((c) => c.hasPaymentError).length;
  const isDelayed = (c: CustomerRow) => {
    const { status } = clientStatus(c);
    return status === "sinpagar" || status === "caducado";
  };
  const delayedCount = customers.filter(isDelayed).length;

  const activeMonthIds = useMemo(() => {
    if (!activeMonth) return null;
    return new Set(
      payments.filter((p) => p.date.startsWith(activeMonth) && p.customerId).map((p) => p.customerId!),
    );
  }, [payments, activeMonth]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers
      .filter((c) => {
        if (activeMonthIds && !c.stripeIds.some((sid) => activeMonthIds.has(sid))) return false;
        if (filter === "recurring"   && !c.isRecurring)   return false;
        if (filter === "occasional"  &&  c.isRecurring)   return false;
        if (filter === "discount"    && !hasDiscount(c))   return false;
        if (filter === "error"       && !c.hasPaymentError)  return false;
        if (filter === "delayed"     && !isDelayed(c))       return false;
        if (planFilter && currentPlanProduct(c) !== planFilter) return false;
        if (!q) return true;
        const dSub  = c.daysSinceLastSub  ?? Infinity;
        const dPack = c.daysSinceLastPack ?? Infinity;
        const planType    = dSub <= dPack && dSub < Infinity ? "sub" : dPack < Infinity ? "pack" : "session";
        const planProduct = planType === "sub" ? c.lastSubProduct : planType === "pack" ? c.lastPackProduct : null;
        const planText    = planProduct ? `${planProduct} ${productAbbr(planProduct)}`.toLowerCase() : "por sesión";
        return (
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          planText.includes(q)
        );
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortKey === "totalSpent")           diff = a.totalSpent - b.totalSpent;
        else if (sortKey === "lastPaymentDate") diff = (a.lastPaymentDate ?? "").localeCompare(b.lastPaymentDate ?? "");
        else                                    diff = (a.name ?? "").localeCompare(b.name ?? "", "es");
        return sortDir === "desc" ? -diff : diff;
      });
  }, [customers, search, filter, planFilter, sortKey, sortDir, activeMonthIds]);

  function downloadCsv() {
    const rows = [
      ["Nombre", "Email", "Tipo", "Plan", "Total gastado (€)", "Pagos", "Fecha alta", "Último pago", "Estado", "Descuento"],
      ...filtered.map((c) => {
        const dSub  = c.daysSinceLastSub  ?? Infinity;
        const dPack = c.daysSinceLastPack ?? Infinity;
        const ptCsv = dSub <= dPack && dSub < Infinity ? "sub" : dPack < Infinity ? "pack" : "session";
        const tipo  = ptCsv === "sub" ? "Suscripción" : ptCsv === "pack" ? "Pack" : "Por sesión";
        const plan  = planBadgeCfg(ptCsv, c.lastSubProduct, c.lastPackProduct).label;
        const { status } = clientStatus(c);
        return [
          c.name ?? "",
          c.email ?? "",
          tipo,
          plan,
          c.totalSpent.toFixed(2),
          c.paymentCount,
          c.firstPaymentDate ?? "",
          c.lastPaymentDate ?? "",
          status,
          c.discount ? (c.discount.percentOff != null ? `-${c.discount.percentOff}%` : c.discount.name) : "",
        ];
      }),
    ];
    const csv  = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `clientes-aura-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filterLabels: { key: Filter; label: string; count?: number }[] = [
    { key: "all",        label: "Todos" },
    { key: "recurring",  label: "Recurrentes" },
    { key: "occasional", label: "Ocasionales" },
    { key: "delayed",    label: "Retraso en renovar", count: delayedCount },
    { key: "discount",   label: "Descuento", count: discountCount },
    { key: "error",      label: "Error de pago", count: errorCount },
  ];

  const MES: Record<string, string> = { "01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun","07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic" };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div>
      {activeMonth && (
        <div className="flex items-center justify-between mb-4 px-4 py-3 bg-primary/10 border border-primary/30 rounded-xl">
          <div className="flex items-center gap-2.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
            </svg>
            <div>
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Filtro activo · desde el gráfico</p>
              <p className="text-sm font-bold text-navy">{MES[activeMonth.slice(5)] ?? activeMonth.slice(5)} {activeMonth.slice(0, 4)} · {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button
            onClick={onClearMonth}
            className="flex items-center gap-1 text-xs font-semibold text-primary/70 hover:text-primary bg-white border border-primary/20 hover:border-primary/40 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Quitar filtro
          </button>
        </div>
      )}
      <ClientesTableV2
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        filterLabels={filterLabels}
        planFilter={planFilter}
        onPlanFilterChange={setPlanFilter}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={toggleSort}
        rows={pageRows}
        totalCount={filtered.length}
        page={safePage}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onRowClick={setSelected}
        onExportCsv={downloadCsv}
      />

      {selected && (
        <CustomerDrawer key={selected.id} customer={selected} payments={payments} onClose={() => setSelected(null)} />
      )}
    </div>
  );
});

export default ClientesTable;
