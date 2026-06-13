"use client";

import { useState, useMemo } from "react";
import { fmt } from "@/lib/analytics";
import type { StripeCustomer } from "@/lib/stripeCustomers";

type SortKey = "totalSpent" | "paymentCount" | "lastPaymentDate" | "name";
type SortDir = "asc" | "desc";
type Filter  = "all" | "active" | "inactive" | "discount";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-block ml-1 transition-colors ${active ? "text-primary" : "text-navy/20"}`}>
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

export default function ClientesTable({ customers }: { customers: StripeCustomer[] }) {
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("totalSpent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // Top 3 by total spent get a crown badge
  const topIds = useMemo(() => {
    return [...customers]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 3)
      .map((c) => c.id);
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers
      .filter((c) => {
        if (filter === "active"   && !c.subscription)  return false;
        if (filter === "inactive" &&  c.subscription)  return false;
        if (filter === "discount" && !c.discount)       return false;
        if (!q) return true;
        return (
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortKey === "totalSpent")        diff = a.totalSpent - b.totalSpent;
        else if (sortKey === "paymentCount") diff = a.paymentCount - b.paymentCount;
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
        className={`px-5 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider cursor-pointer select-none hover:text-navy/60 transition-colors ${className}`}
        onClick={() => toggleSort(col)}
      >
        {label}
        <SortIcon active={sortKey === col} dir={sortDir} />
      </th>
    );
  }

  const filterLabels: { key: Filter; label: string }[] = [
    { key: "all",      label: "Todos" },
    { key: "active",   label: "Con suscripción" },
    { key: "inactive", label: "Sin suscripción" },
    { key: "discount", label: "Con descuento" },
  ];

  const discountCount = customers.filter((c) => c.discount).length;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/30"
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
            className="w-full pl-9 pr-4 py-2 text-sm border border-navy/15 rounded-lg bg-white text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/30 hover:text-navy/60 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-navy/[0.04] rounded-lg p-1">
          {filterLabels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === key
                  ? "bg-white text-navy shadow-sm"
                  : "text-navy/40 hover:text-navy/70"
              }`}
            >
              {label}
              {key === "discount" && discountCount > 0 && (
                <span className="ml-1 text-[10px] bg-warning/20 text-warning px-1 rounded-full">
                  {discountCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      {(search || filter !== "all") && (
        <p className="text-xs text-navy/35 mb-3">
          {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"} encontrados
        </p>
      )}

      {/* Table */}
      <div className="bg-white border border-navy/10 rounded shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/[0.06]">
                <ThSort col="name"            label="Cliente"       className="text-left" />
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider">
                  Plan
                </th>
                <ThSort col="totalSpent"      label="Total gastado" className="text-right" />
                <ThSort col="paymentCount"    label="Pagos"         className="text-right hidden sm:table-cell" />
                <ThSort col="lastPaymentDate" label="Último pago"   className="text-right hidden sm:table-cell" />
                <th className="text-center px-5 py-3 text-[11px] font-semibold text-navy/35 uppercase tracking-wider">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-navy/30 text-sm">
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
                      className={`border-b border-navy/[0.04] last:border-0 transition-colors ${
                        isTop && topRank === 0
                          ? "hover:bg-warning/[0.03]"
                          : "hover:bg-navy/[0.015]"
                      } ${i % 2 === 0 ? "" : "bg-navy/[0.008]"}`}
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
                            {c.email && <p className="text-[11px] text-navy/35 truncate max-w-[160px]">{c.email}</p>}
                          </div>
                          {c.discount && <DiscountBadge discount={c.discount} />}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-navy/60">
                        {c.subscription ? (
                          <span className="text-xs bg-primary/[0.08] text-primary px-2 py-0.5 rounded-full font-medium">
                            {c.subscription.plan}
                          </span>
                        ) : (
                          <span className="text-xs text-navy/30">Sin suscripción</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-navy tabular-nums">{fmt(c.totalSpent)}</td>
                      <td className="px-5 py-3 text-right text-navy/50 hidden sm:table-cell">{c.paymentCount}</td>
                      <td className="px-5 py-3 text-right text-navy/40 text-xs hidden sm:table-cell">
                        {c.lastPaymentDate ? c.lastPaymentDate.split("-").reverse().join("/") : "—"}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {c.subscription ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-success font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                            Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-navy/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-navy/20 inline-block" />
                            Inactivo
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
    </div>
  );
}
