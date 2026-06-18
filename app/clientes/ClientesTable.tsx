"use client";

import { useState, useMemo, forwardRef, useImperativeHandle } from "react";
import Drawer from "@/app/components/Drawer";
import { fmt } from "@/lib/analytics";
import type { StripeCustomer } from "@/lib/stripeCustomers";
import type { StripePayment } from "@/lib/stripePayments";

export type CustomerRow = StripeCustomer & { daysSinceLastSub?: number | null; daysSinceLastPack?: number | null; lastPackProduct?: string | null; lastSubProduct?: string | null; isActive?: boolean; isNew?: boolean };
export type ClientesTableHandle = { openCustomer: (id: string) => void };

type SortKey = "totalSpent" | "lastPaymentDate" | "name";
type SortDir = "asc" | "desc";
type Filter  = "all" | "recurring" | "occasional" | "discount" | "error" | "churn";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-block ml-1 transition-colors ${active ? "text-primary" : "text-navy/50"}`}>
      {active && dir === "asc" ? "↑" : "↓"}
    </span>
  );
}

function DiscountBadge({ discount }: { discount: NonNullable<StripeCustomer["discount"]> }) {
  const label = discount.percentOff != null
    ? `-${discount.percentOff}%`
    : discount.amountOff != null
    ? `-${fmt(discount.amountOff)}`
    : "Dto.";
  return (
    <span
      title={discount.name}
      className="ml-1.5 text-[10px] font-semibold bg-warning/15 text-warning px-1.5 py-0.5 rounded-full"
    >
      {label}
    </span>
  );
}

function fmtDate(d: string) {
  return d.split("-").reverse().join("/");
}

function timeAgo(dateStr: string): string {
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


function paymentExpiry(p: { category: string; inferredProduct: string; date: string }): string | null {
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
      return d > 15 ? { status: "caducado", days: d - 15 } : { status: "ok", days: null };
    }
    if (prod === "Pack 4 clases" || prod === "Pack 8 clases") {
      if (d > 105) return { status: "baja",      days: d - 90 };
      if (d > 90)  return { status: "caducado",  days: d - 90 };
      if (d > 76)  return { status: "porvencer", days: 90 - d };
    }
  }
  return { status: "ok", days: null };
}

function initials(name: string | null, email: string | null): string {
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
  const [sortKey,  setSortKey]  = useState<SortKey>("totalSpent");
  const [sortDir,  setSortDir]  = useState<SortDir>("desc");
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [stripeOpen, setStripeOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    openCustomer(id: string) {
      const c = customers.find((c) => c.id === id);
      if (c) { setSelected(c); setStripeOpen(false); }
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

  const selectedPayments = useMemo(
    () => selected
      ? payments
          .filter((p) => selected.stripeIds.includes(p.customerId ?? ""))
          .sort((a, b) => b.date.localeCompare(a.date))
      : [],
    [payments, selected],
  );

  const topCustomers = useMemo(
    () => [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5),
    [customers],
  );

  const couponStripeIds = useMemo(
    () => new Set(payments.filter((p) => p.inferredType === "coupon" && p.customerId).map((p) => p.customerId!)),
    [payments],
  );

  const hasDiscount = (c: CustomerRow) => !!c.discount || c.stripeIds.some((sid) => couponStripeIds.has(sid));

  const discountCount = customers.filter(hasDiscount).length;
  const errorCount    = customers.filter((c) => c.hasPaymentError).length;
  const churnCount    = customers.filter((c) => clientStatus(c).status !== "ok").length;

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
        if (filter === "churn"       && clientStatus(c).status === "ok") return false;
        if (!q) return true;
        return (
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortKey === "totalSpent")           diff = a.totalSpent - b.totalSpent;
        else if (sortKey === "lastPaymentDate") diff = (a.lastPaymentDate ?? "").localeCompare(b.lastPaymentDate ?? "");
        else                                    diff = (a.name ?? "").localeCompare(b.name ?? "", "es");
        return sortDir === "desc" ? -diff : diff;
      });
  }, [customers, search, filter, sortKey, sortDir, activeMonthIds]);

  function ThSort({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) {
    return (
      <th
        className={`px-5 py-3 text-[11px] font-semibold text-navy/50 uppercase tracking-wider cursor-pointer select-none hover:text-navy/60 transition-colors ${className}`}
        onClick={() => toggleSort(col)}
      >
        {label}
        <SortIcon active={sortKey === col} dir={sortDir} />
      </th>
    );
  }

  function downloadCsv() {
    const rows = [
      ["Nombre", "Email", "Tipo", "Plan", "Total gastado (€)", "Pagos", "Fecha alta", "Último pago", "Estado", "Descuento"],
      ...filtered.map((c) => {
        const dSub  = c.daysSinceLastSub  ?? Infinity;
        const dPack = c.daysSinceLastPack ?? Infinity;
        const ptCsv = dSub <= dPack && dSub < Infinity ? "sub" : dPack < Infinity ? "pack" : "session";
        const tipo  = ptCsv === "sub" ? "Suscripción" : ptCsv === "pack" ? "Pack" : "Por sesión";
        const plan = c.isRecurring ? (c.lastSubProduct ?? "") : (c.lastPackProduct ?? "");
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
    { key: "discount",   label: "Descuento", count: discountCount },
    { key: "error",      label: "Error de pago", count: errorCount },
    { key: "churn",      label: "Posibles bajas", count: churnCount },
  ];

  const MES: Record<string, string> = { "01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun","07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic" };

  return (
    <div>
      {activeMonth && (
        <div className="flex items-center justify-between mb-3 px-4 py-2 bg-primary/[0.06] border border-primary/20 rounded-xl text-sm">
          <span className="text-primary font-medium">
            Filtrando: {MES[activeMonth.slice(5)] ?? activeMonth.slice(5)} {activeMonth.slice(0, 4)} · {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
          </span>
          <button onClick={onClearMonth} className="text-primary/60 hover:text-primary text-xs font-medium">Limpiar ✕</button>
        </div>
      )}
      {/* Top 5 clientes */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-navy/[0.06]">
          <p className="text-sm font-semibold text-navy">Principales clientes</p>
          <p className="text-xs text-navy/40">Por total gastado</p>
        </div>
        <div className="divide-y divide-navy/[0.05]">
          {topCustomers.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelected(c); setStripeOpen(false); }}
              className="w-full flex items-center justify-between gap-4 px-5 py-3 hover:bg-primary/[0.025] transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy truncate">{c.name ?? "—"}</p>
                {c.email && <p className="text-xs text-navy/45 truncate">{c.email}</p>}
              </div>
              <span className="shrink-0 text-sm font-semibold text-navy tabular-nums">{fmt(c.totalSpent)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/45"
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-navy/15 rounded-lg bg-white text-navy placeholder:text-navy/45 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/45 hover:text-navy/60 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Export */}
        <button
          onClick={downloadCsv}
          title="Exportar tabla actual a CSV"
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-navy/50 hover:text-navy border border-navy/15 rounded-lg bg-white hover:bg-navy/[0.02] transition-colors whitespace-nowrap"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          CSV
        </button>

        {/* Filter tabs */}
        <div className="flex items-center border border-navy/[0.12] rounded-lg bg-white p-1 gap-0.5 flex-wrap">
          {filterLabels.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === key
                  ? "bg-navy text-white"
                  : "text-navy/55 hover:text-navy"
              }`}
            >
              {label}
              {count != null && count > 0 && (
                <span className={`ml-1 text-[10px] px-1 rounded-full ${
                  key === "churn" ? "bg-warning/20 text-warning" : "bg-warning/20 text-warning"
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {(search || filter !== "all") && (
        <p className="text-xs text-navy/50 mb-3">
          {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"} encontrados
        </p>
      )}

      {/* Table */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/[0.06]">
                <ThSort col="name"            label="Cliente"      className="text-left" />
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-navy/50 uppercase tracking-wider">Plan</th>
                <ThSort col="totalSpent"      label="Total"        className="text-right" />
                <ThSort col="lastPaymentDate" label="Último pago"  className="text-right hidden sm:table-cell" />
                <th className="text-center px-5 py-3 text-[11px] font-semibold text-navy/50 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-navy/45 text-sm">
                    No hay clientes que coincidan con tu búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => {
                  const { status, days } = clientStatus(c);
                  const dSub  = c.daysSinceLastSub  ?? Infinity;
                  const dPack = c.daysSinceLastPack ?? Infinity;
                  const planType = dSub <= dPack && dSub < Infinity ? "sub"
                                 : dPack < Infinity                  ? "pack"
                                 : "session";
                  return (
                    <tr
                      key={c.id}
                      onClick={() => { setSelected(c); setStripeOpen(false); }}
                      className={`border-b border-navy/[0.04] last:border-0 transition-colors cursor-pointer hover:bg-primary/[0.025] ${
                        status === "baja" ? "bg-danger/[0.04]" : status === "sinpagar" || status === "caducado" ? "bg-warning/[0.04]" : status === "porvencer" ? "bg-amber-50/60" : i % 2 === 0 ? "" : "bg-navy/[0.008]"
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="min-w-0">
                            <p className="font-medium text-navy truncate max-w-[160px]">{c.name ?? "—"}</p>
                            {c.email && <p className="text-[11px] text-navy/50 truncate max-w-[160px]">{c.email}</p>}
                          </div>
                          {c.discount && <DiscountBadge discount={c.discount} />}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {planType === "sub" ? (
                          <div>
                            <span className="text-xs bg-primary/[0.08] text-primary px-2 py-0.5 rounded-full font-medium">Suscripción</span>
                            {c.lastSubProduct && c.lastSubProduct !== "Con cupón" && (
                              <p className="text-[11px] text-navy/40 mt-1">{c.lastSubProduct}</p>
                            )}
                          </div>
                        ) : planType === "pack" ? (
                          <div>
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">Pack</span>
                            <p className="text-[11px] text-navy/40 mt-1">
                              {(() => {
                                const validity = c.lastPackProduct === "Pack Benvinguda" ? 15 : 90;
                                const remaining = validity - (c.daysSinceLastPack ?? 0);
                                return remaining > 0 ? `finaliza en ${remaining}d` : "vencido";
                              })()}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-navy/45">Por sesión</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <p className="font-semibold text-navy tabular-nums">{fmt(c.totalSpent)}</p>
                        <p className="text-[11px] text-navy/40 mt-0.5">{c.paymentCount} pagos</p>
                      </td>
                      <td className="px-5 py-3 text-right text-navy/55 text-xs hidden sm:table-cell">
                        {c.lastPaymentDate ? fmtDate(c.lastPaymentDate) : "—"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {status === "baja" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-danger font-medium whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0 inline-block" />
                            {c.isRecurring ? `Baja · ${days}d` : `Pack vencido · ${days}d`}
                          </span>
                        ) : status === "sinpagar" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-warning font-medium whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 inline-block" />
                            Sin pagar · {days}d tarde
                          </span>
                        ) : status === "caducado" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-warning font-medium whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 inline-block" />
                            Pack vencido · {days}d
                          </span>
                        ) : status === "porvencer" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-500 font-medium whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 inline-block" />
                            Vence en {days}d
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-success font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                            Al día
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <Drawer
          maxWidth="max-w-[460px]"
          header={
            <div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-base font-bold text-primary">{initials(selected.name, selected.email)}</span>
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-navy leading-tight truncate">
                    {selected.name ?? "Sin nombre"}
                  </h2>
                  {selected.email && (
                    <p className="text-xs text-navy/50 truncate">{selected.email}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {(() => {
                  const dSub  = selected.daysSinceLastSub  ?? Infinity;
                  const dPack = selected.daysSinceLastPack ?? Infinity;
                  const pt = dSub <= dPack && dSub < Infinity ? "sub"
                           : dPack < Infinity                  ? "pack"
                           : "session";
                  if (pt === "sub")  return <span className="text-xs bg-primary/[0.08] text-primary px-2.5 py-1 rounded-full font-medium">Suscripción</span>;
                  if (pt === "pack") return <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium">Pack</span>;
                  return <span className="text-xs bg-navy/[0.06] text-navy/55 px-2.5 py-1 rounded-full font-medium">Por sesión</span>;
                })()}
                {(() => {
                  const { status, days } = clientStatus(selected);
                  if (status === "baja") return (
                    <span className="text-xs bg-danger/10 text-danger px-2.5 py-1 rounded-full font-medium flex items-center gap-1 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger inline-block shrink-0" />
                      {selected.isRecurring ? `Baja · ${days}d sin pagar` : `Pack vencido · ${days}d`}
                    </span>
                  );
                  if (status === "sinpagar") return (
                    <span className="text-xs bg-warning/10 text-warning px-2.5 py-1 rounded-full font-medium flex items-center gap-1 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block shrink-0" />
                      Sin pagar · {days}d tarde
                    </span>
                  );
                  if (status === "caducado") return (
                    <span className="text-xs bg-warning/10 text-warning px-2.5 py-1 rounded-full font-medium flex items-center gap-1 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block shrink-0" />
                      Pack vencido · {days}d
                    </span>
                  );
                  if (status === "porvencer") return (
                    <span className="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full font-medium flex items-center gap-1 whitespace-nowrap border border-amber-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" />
                      Vence en {days}d
                    </span>
                  );
                  return (
                    <span className="text-xs bg-success/10 text-success px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                      Al día
                    </span>
                  );
                })()}
                {selected.discount && (
                  <span className="text-xs bg-warning/10 text-warning px-2.5 py-1 rounded-full font-medium">
                    {selected.discount.percentOff != null
                      ? `-${selected.discount.percentOff}%`
                      : selected.discount.name}
                  </span>
                )}
              </div>
            </div>
          }
          footer={(() => {
            const ids = selected.stripeIds;
            const extIcon = (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            );
            if (ids.length === 1) {
              return (
                <a
                  href={`https://dashboard.stripe.com/customers/${ids[0]}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#635bff] rounded-xl hover:bg-[#4f46e5] transition-colors"
                >
                  {extIcon} Ver en Stripe
                </a>
              );
            }
            if (ids.length === 2) {
              return (
                <div className="flex gap-2">
                  {ids.map((sid, i) => (
                    <a key={sid}
                      href={`https://dashboard.stripe.com/customers/${sid}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-white bg-[#635bff] rounded-xl hover:bg-[#4f46e5] transition-colors"
                    >
                      {extIcon} Perfil {i + 1}
                    </a>
                  ))}
                </div>
              );
            }
            // 3+ perfiles → dropdown
            return (
              <div className="relative">
                <button
                  onClick={() => setStripeOpen((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#635bff] rounded-xl hover:bg-[#4f46e5] transition-colors"
                >
                  <span className="flex items-center gap-2">{extIcon} Ver en Stripe</span>
                  <span className="flex items-center gap-1.5 text-white/70 text-xs font-medium">
                    {ids.length} perfiles
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${stripeOpen ? "rotate-180" : ""}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </span>
                </button>
                {stripeOpen && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-navy/[0.10] rounded-xl shadow-lg overflow-hidden z-10 max-h-52 overflow-y-auto">
                    {ids.map((sid, i) => (
                      <a key={sid}
                        href={`https://dashboard.stripe.com/customers/${sid}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-[#635bff] hover:bg-[#635bff]/[0.05] border-b border-navy/[0.05] last:border-0 transition-colors"
                      >
                        Perfil {i + 1}
                        <span className="text-[10px] text-navy/30 font-mono">{sid.slice(-8)}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          onClose={() => setSelected(null)}
        >
          {/* Stats */}
          <div className="grid grid-cols-3 divide-x divide-navy/[0.06] border-b border-navy/[0.07]">
            <div className="px-5 py-4 text-center">
              <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Total gastado</p>
              <p className="text-lg font-bold text-navy tabular-nums">{fmt(selected.totalSpent)}</p>
            </div>
            <div className="px-5 py-4 text-center">
              <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Pagos</p>
              <p className="text-lg font-bold text-navy">{selected.paymentCount}</p>
            </div>
            <div className="px-5 py-4 text-center">
              <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Primer pago</p>
              <p className="text-sm font-semibold text-navy/70">
                {selected.firstPaymentDate ? fmtDate(selected.firstPaymentDate) : "—"}
              </p>
              {selected.firstPaymentDate && (
                <p className="text-[10px] text-navy/35 mt-0.5">{timeAgo(selected.firstPaymentDate)}</p>
              )}
            </div>
          </div>

          {/* Payment list */}
          <p className="px-6 pt-4 pb-2 text-[11px] font-semibold text-navy/40 uppercase tracking-wider">
            Historial de pagos
          </p>
          <div className="divide-y divide-navy/[0.05]">
            {selectedPayments.length === 0 && (
              <p className="px-6 py-8 text-sm text-center text-navy/40">Sin pagos registrados</p>
            )}
            {selectedPayments.map((p) => {
              const expiry = paymentExpiry(p);
              const today = new Date().toISOString().split("T")[0];
              const isExpired = expiry != null && expiry < today;
              const isCurrent = expiry != null && expiry >= today;
              return (
                <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">
                        {p.inferredProduct !== "Otro" ? p.inferredProduct : (p.description ?? p.category)}
                      </p>
                      {p.inferredType === "coupon" && (
                        <span className="shrink-0 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-full">
                          cupón
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-navy/45">{fmtDate(p.date)}</p>
                      {expiry && (
                        <p className={`text-[10px] ${isCurrent ? "text-success/70" : "text-navy/30"}`}>
                          · hasta {fmtDate(expiry)}{isExpired ? " (vencido)" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-navy tabular-nums">
                    {fmt(p.amount)}
                  </span>
                </div>
              );
            })}
          </div>

        </Drawer>
      )}
    </div>
  );
});

export default ClientesTable;
