"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { normalizeText } from "@/lib/normalizeText";
import { drawerNav } from "@/lib/drawerNav";
import type { UrbanClientRow } from "@/lib/clientActivityV2";
import type { MemberClient } from "@/lib/memberClientsV2";
import type { StripePayment } from "@/lib/stripePayments";
import MemberDrawer from "./MemberDrawer";
import ClientesMatrizUrbanV2 from "./ClientesMatrizUrbanV2";
import { monthLabel } from "./ClientesMatrizCompras";

export type UrbanSortKey = "name" | "total" | "first";
const PAGE_SIZE = 100;

type Props = {
  rows: UrbanClientRow[];
  clients: MemberClient[];
  payments: StripePayment[];
  extraControls?: ReactNode;
};

export default function ClientesMatrizUrban({ rows, clients, payments, extraControls }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<UrbanSortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<UrbanClientRow | null>(null);

  // La ficha completa (plan, pagos, actividad) vive en el mismo MemberDrawer que usa la
  // pestaña "Clientes" - se reutiliza en vez de montar otro drawer para no duplicar esa vista.
  const clientByMemberId = useMemo(() => {
    const map = new Map<number, MemberClient>();
    for (const c of clients) if (c.memberId != null) map.set(c.memberId, c);
    return map;
  }, [clients]);

  const months = useMemo(() => {
    const now = new Date();
    const start = new Date(2026, 1, 1); // Feb 2026 - apertura
    const list: string[] = [];
    const cur = new Date(start);
    while (cur <= now) {
      list.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return list;
  }, []);
  const lastMonth = months[months.length - 1];

  const visibleRows = useMemo(() => {
    const q = normalizeText(search).trim();
    let list = rows.filter((r) => {
      if (q && !normalizeText(r.name).includes(q)) return false;
      if (onlyInactive && r.byMonth[lastMonth]?.classes) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === "first") {
        if (!a.firstClassDate && !b.firstClassDate) return 0;
        if (!a.firstClassDate) return 1;
        if (!b.firstClassDate) return -1;
        const cmp = a.firstClassDate.localeCompare(b.firstClassDate);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const cmp = sortKey === "name" ? a.name.localeCompare(b.name, "es") : a.totalClasses - b.totalClasses;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, search, sortKey, sortDir, onlyInactive, lastMonth]);

  useEffect(() => { setPage(0); }, [search, sortKey, sortDir, onlyInactive]);

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = visibleRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const monthTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const m of months) totals[m] = visibleRows.reduce((sum, r) => sum + (r.byMonth[m]?.classes ?? 0), 0);
    return totals;
  }, [visibleRows, months]);

  const grandTotalClasses = useMemo(() => visibleRows.reduce((s, r) => s + r.totalClasses, 0), [visibleRows]);
  const grandTotalEstimated = useMemo(() => visibleRows.reduce((s, r) => s + r.totalEstimated, 0), [visibleRows]);

  function toggleSort(key: UrbanSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "total" ? "desc" : "asc"); }
  }

  function downloadCsv() {
    const header = ["Cliente", "Email", "Primera clase", ...months.map(monthLabel), "Total clases", "Total estimado €"];
    const csvRows = visibleRows.map((r) => [
      r.name,
      r.email ?? "",
      r.firstClassDate ?? "",
      ...months.map((m) => String(r.byMonth[m]?.classes ?? 0)),
      String(r.totalClasses),
      r.totalEstimated.toFixed(2),
    ]);
    const csv = [header, ...csvRows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `urban-por-cliente-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows.length === 0) return null;

  const selectedClient = selected ? (clientByMemberId.get(selected.memberId) ?? null) : null;

  return (
    <div className="flex flex-col items-center">
      <ClientesMatrizUrbanV2
        search={search}
        onSearchChange={setSearch}
        onlyInactive={onlyInactive}
        onToggleOnlyInactive={() => setOnlyInactive((v) => !v)}
        lastMonth={lastMonth}
        months={months}
        rows={pageRows}
        sortKey={sortKey}
        sortDir={sortDir}
        onToggleSort={toggleSort}
        monthTotals={monthTotals}
        grandTotalClasses={grandTotalClasses}
        grandTotalEstimated={grandTotalEstimated}
        totalCount={visibleRows.length}
        page={safePage}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onRowClick={setSelected}
        onExportCsv={downloadCsv}
        extraControls={extraControls}
      />
      {selectedClient && (() => {
        // Navegación ↑/↓ solo entre las filas que sí tienen ficha en Momence (memberId
        // resuelto) - las que no, no abren drawer al hacer click (ver ClientesMatrizUrbanV2).
        const resolved = visibleRows
          .map((r) => clientByMemberId.get(r.memberId))
          .filter((c): c is MemberClient => !!c);
        const { prev, next } = drawerNav(resolved, selectedClient.id, (c) => c.id);
        return (
          <MemberDrawer
            key={selectedClient.id}
            client={selectedClient}
            payments={payments}
            onClose={() => setSelected(null)}
            onPrev={prev ? () => setSelected(rows.find((r) => r.memberId === prev.memberId) ?? null) : undefined}
            onNext={next ? () => setSelected(rows.find((r) => r.memberId === next.memberId) ?? null) : undefined}
            hasPrev={!!prev}
            hasNext={!!next}
          />
        );
      })()}
    </div>
  );
}
