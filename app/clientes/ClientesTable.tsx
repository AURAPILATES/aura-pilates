"use client";

import { useState, useMemo, useEffect } from "react";
import { fmt } from "@/lib/analytics";
import type { StripeCustomer } from "@/lib/stripeCustomers";
import type { StripePayment } from "@/lib/stripePayments";

type CustomerRow = StripeCustomer & { possibleChurn?: boolean; isActive?: boolean; isNew?: boolean };

type SortKey = "totalSpent" | "paymentCount" | "lastPaymentDate" | "name";
type SortDir = "asc" | "desc";
type Filter  = "all" | "recurring" | "occasional" | "discount" | "churn";

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

function initials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

function CustomerDrawer({
  customer,
  payments,
  onClose,
}: {
  customer: CustomerRow;
  payments: StripePayment[];
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const customerPayments = useMemo(
    () => payments
      .filter((p) => p.customerId === customer.id)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [payments, customer.id],
  );

  const ini = initials(customer.name, customer.email);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-navy/[0.07]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-base font-bold text-primary">{ini}</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-navy font-display leading-tight">
                  {customer.name ?? "Sin nombre"}
                </h2>
                {customer.email && (
                  <p className="text-sm text-navy/50 truncate">{customer.email}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-navy/40 hover:text-navy/70 hover:bg-navy/[0.05] transition-colors shrink-0 mt-0.5"
              aria-label="Cerrar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {customer.isRecurring ? (
              <span className="text-xs bg-primary/[0.08] text-primary px-2.5 py-1 rounded-full font-medium">Recurrente</span>
            ) : (
              <span className="text-xs bg-navy/[0.06] text-navy/55 px-2.5 py-1 rounded-full font-medium">Ocasional</span>
            )}
            {customer.possibleChurn ? (
              <span className="text-xs bg-warning/10 text-warning px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" />
                Posible baja
              </span>
            ) : (
              <span className="text-xs bg-success/10 text-success px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Al día
              </span>
            )}
            {customer.discount && (
              <span className="text-xs bg-warning/10 text-warning px-2.5 py-1 rounded-full font-medium">
                {customer.discount.percentOff != null
                  ? `-${customer.discount.percentOff}%`
                  : customer.discount.name}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x divide-navy/[0.06] border-b border-navy/[0.07]">
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Total gastado</p>
            <p className="text-lg font-bold text-navy tabular-nums">{fmt(customer.totalSpent)}</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Pagos</p>
            <p className="text-lg font-bold text-navy">{customer.paymentCount}</p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Primer pago</p>
            <p className="text-sm font-semibold text-navy/70">
              {customer.firstPaymentDate ? fmtDate(customer.firstPaymentDate) : "—"}
            </p>
          </div>
        </div>

        {/* Payment list */}
        <div className="flex-1 overflow-y-auto">
          <p className="px-6 pt-4 pb-2 text-[11px] font-semibold text-navy/40 uppercase tracking-wider">
            Historial de pagos
          </p>
          <div className="divide-y divide-navy/[0.05]">
            {customerPayments.length === 0 && (
              <p className="px-6 py-8 text-sm text-center text-navy/40">Sin pagos registrados</p>
            )}
            {customerPayments.map((p) => (
              <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy truncate">
                    {p.description ?? p.category}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-navy/45">{fmtDate(p.date)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-navy/[0.05] text-navy/45 font-medium">
                      {p.category}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-navy tabular-nums">
                  {fmt(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-navy/[0.07]">
          <a
            href={`https://dashboard.stripe.com/customers/${customer.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#635bff] rounded-xl hover:bg-[#4f46e5] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Ver en Stripe
          </a>
        </div>
      </div>
    </>
  );
}

export default function ClientesTable({ customers, payments }: { customers: CustomerRow[]; payments: StripePayment[] }) {
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<Filter>("all");
  const [sortKey,  setSortKey]  = useState<SortKey>("totalSpent");
  const [sortDir,  setSortDir]  = useState<SortDir>("desc");
  const [selected, setSelected] = useState<CustomerRow | null>(null);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const topIds = useMemo(() => {
    return [...customers]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 3)
      .map((c) => c.id);
  }, [customers]);

  const discountCount = customers.filter((c) => c.discount).length;
  const churnCount    = customers.filter((c) => c.possibleChurn).length;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers
      .filter((c) => {
        if (filter === "recurring"   && !c.isRecurring)   return false;
        if (filter === "occasional"  &&  c.isRecurring)   return false;
        if (filter === "discount"    && !c.discount)       return false;
        if (filter === "churn"       && !c.possibleChurn) return false;
        if (!q) return true;
        return (
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortKey === "totalSpent")          diff = a.totalSpent - b.totalSpent;
        else if (sortKey === "paymentCount")   diff = a.paymentCount - b.paymentCount;
        else if (sortKey === "lastPaymentDate") {
          diff = (a.lastPaymentDate ?? "").localeCompare(b.lastPaymentDate ?? "");
        } else {
          diff = (a.name ?? "").localeCompare(b.name ?? "", "es");
        }
        return sortDir === "desc" ? -diff : diff;
      });
  }, [customers, search, filter, sortKey, sortDir]);

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
      ["Nombre", "Email", "Frecuencia", "Total gastado (€)", "Pagos", "Primer pago", "Último pago", "Descuento"],
      ...filtered.map((c) => [
        c.name ?? "",
        c.email ?? "",
        c.isRecurring ? "Recurrente" : "Ocasional",
        c.totalSpent.toFixed(2),
        c.paymentCount,
        c.firstPaymentDate ?? "",
        c.lastPaymentDate ?? "",
        c.discount ? (c.discount.percentOff != null ? `-${c.discount.percentOff}%` : c.discount.name) : "",
      ]),
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
    { key: "churn",      label: "Sin pagar este mes", count: churnCount },
  ];

  return (
    <div>
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
        <div className="flex gap-1 bg-navy/[0.04] rounded-lg p-1 flex-wrap">
          {filterLabels.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === key
                  ? "bg-white text-navy shadow-sm"
                  : "text-navy/55 hover:text-navy/70"
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
                <ThSort col="name"            label="Cliente"       className="text-left" />
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-navy/50 uppercase tracking-wider">
                  Frecuencia
                </th>
                <ThSort col="totalSpent"      label="Total gastado" className="text-right" />
                <ThSort col="paymentCount"    label="Pagos"         className="text-right hidden sm:table-cell" />
                <ThSort col="lastPaymentDate" label="Último pago"   className="text-right hidden sm:table-cell" />
                <th className="text-center px-5 py-3 text-[11px] font-semibold text-navy/50 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-navy/45 text-sm">
                    No hay clientes que coincidan con tu búsqueda.
                  </td>
                </tr>
              ) : (
                filtered.map((c, i) => {
                  const topRank = topIds.indexOf(c.id);
                  const isTop   = topRank !== -1;
                  const crowns  = ["👑", "🥈", "🥉"];

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className={`border-b border-navy/[0.04] last:border-0 transition-colors cursor-pointer hover:bg-primary/[0.025] ${
                        c.possibleChurn ? "bg-warning/[0.04]" : i % 2 === 0 ? "" : "bg-navy/[0.008]"
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {isTop && (
                            <span title={topRank === 0 ? "Top cliente" : `Top ${topRank + 1}`} className="text-sm leading-none">
                              {crowns[topRank]}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-navy truncate max-w-[160px]">{c.name ?? "—"}</p>
                            {c.email && <p className="text-[11px] text-navy/50 truncate max-w-[160px]">{c.email}</p>}
                          </div>
                          {c.discount && <DiscountBadge discount={c.discount} />}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {c.isRecurring ? (
                          <span className="text-xs bg-primary/[0.08] text-primary px-2 py-0.5 rounded-full font-medium">
                            Recurrente
                          </span>
                        ) : (
                          <span className="text-xs text-navy/45">Ocasional</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-navy tabular-nums">{fmt(c.totalSpent)}</td>
                      <td className="px-5 py-3 text-right text-navy/50 hidden sm:table-cell">{c.paymentCount}</td>
                      <td className="px-5 py-3 text-right text-navy/55 text-xs hidden sm:table-cell">
                        {c.lastPaymentDate ? c.lastPaymentDate.split("-").reverse().join("/") : "—"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {c.possibleChurn ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-warning font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" />
                            Sin pagar
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
        <CustomerDrawer
          customer={selected}
          payments={payments}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
