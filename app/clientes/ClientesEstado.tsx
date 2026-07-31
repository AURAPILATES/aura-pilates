"use client";

import { useMemo, useState } from "react";
import Avatar from "@/app/components/Avatar";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import { IconButtonV2 } from "@/app/components/v2/ButtonsV2";
import { tableHeadClassV2, tableRowClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { normalizeText } from "@/lib/normalizeText";
import { fmt } from "@/lib/analytics";
import { initials, timeAgo } from "./ClientesTable";
import MemberDrawer from "./MemberDrawer";
import type { MemberClient, StatusTone, StatusKey } from "@/lib/memberClientsV2";
import type { StripePayment } from "@/lib/stripePayments";

const COLS = "2.4fr 1.3fr 1.5fr 1fr .9fr";
const PAGE_SIZE = 25;

type Filter = "all" | "duplicadas" | "activa" | "congelada" | "pack" | "sin_plan" | "inactivo" | "error";
type SortKey = "name" | "totalSpent" | "lastClass";

const STATUS_IN_FILTER: Record<Exclude<Filter, "all" | "duplicadas">, (k: StatusKey) => boolean> = {
  activa: (k) => k === "activa",
  congelada: (k) => k === "congelada",
  pack: (k) => k === "pack" || k === "pack_bajo" || k === "pack_agotado",
  sin_plan: (k) => k === "sin_plan",
  inactivo: (k) => k === "inactivo",
  error: (k) => k === "error_pago",
};

const TONE_CLS: Record<StatusTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-[#b45309]/10 text-[#b45309] dark:text-[#e8a572]",
  danger: "bg-danger/10 text-danger",
  muted: "bg-navy/[0.05] text-navy/50",
};
const TONE_DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-[#b45309] dark:bg-[#e8a572]",
  danger: "bg-danger",
  muted: "bg-navy/30",
};

function planBadge(plan: MemberClient["plan"]): { label: string; cls: string } {
  if (!plan) return { label: "Sin plan", cls: "bg-navy/[0.05] text-navy/50" };
  const n = plan.name.toLowerCase();
  if (plan.kind === "subscription") {
    if (n.includes("bàsic") || n.includes("basic")) return { label: plan.name, cls: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400" };
    if (n.includes("plus")) return { label: plan.name, cls: "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" };
    if (n.includes("pro")) return { label: plan.name, cls: "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400" };
    return { label: plan.name, cls: "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400" };
  }
  return { label: plan.name, cls: "bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400" };
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      className={`inline-block ml-1 transition-all ${active ? "opacity-100 text-muted" : "opacity-0"} ${active && dir === "desc" ? "" : "rotate-180"}`}>
      <path d="M6 10l6 6 6-6" />
    </svg>
  );
}

export default function ClientesEstado({ clients, payments }: { clients: MemberClient[]; payments: StripePayment[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastClass");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<MemberClient | null>(null);

  const counts = useMemo(() => {
    const c = { congelada: 0, sin_plan: 0, inactivo: 0, error: 0, duplicadas: 0 };
    for (const r of clients) {
      if (r.activeSubCount >= 2) c.duplicadas++;
      if (r.status.key === "congelada") c.congelada++;
      else if (r.status.key === "sin_plan") c.sin_plan++;
      else if (r.status.key === "inactivo") c.inactivo++;
      else if (r.status.key === "error_pago") c.error++;
    }
    return c;
  }, [clients]);

  const filtered = useMemo(() => {
    const q = normalizeText(search.trim());
    const pred = filter === "all" || filter === "duplicadas" ? null : STATUS_IN_FILTER[filter];
    return clients
      .filter((r) => {
        if (filter === "duplicadas" && r.activeSubCount < 2) return false;
        if (pred && !pred(r.status.key)) return false;
        if (!q) return true;
        return normalizeText(`${r.name} ${r.email ?? ""} ${r.plan?.name ?? ""}`).includes(q);
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortKey === "totalSpent") diff = (a.stripe?.totalSpent ?? 0) - (b.stripe?.totalSpent ?? 0);
        else if (sortKey === "lastClass") diff = (a.lastClassDate ?? "").localeCompare(b.lastClassDate ?? "");
        else diff = a.name.localeCompare(b.name, "es");
        return sortDir === "desc" ? -diff : diff;
      });
  }, [clients, search, filter, sortKey, sortDir]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setSortDir("desc"); }
  }
  function changeFilter(f: Filter) { setFilter(f); setPage(0); }
  function changeSearch(v: string) { setSearch(v); setPage(0); }

  function downloadCsv() {
    const head = ["Nombre", "Email", "Teléfono", "Plan", "Tipo", "Estado", "Detalle", "Clases", "Última clase", "Total gastado (€)"];
    const rows = filtered.map((r) => [
      r.name, r.email ?? "", r.phone ?? "",
      r.plan?.name ?? "Sin plan", r.plan?.kind === "subscription" ? "Suscripción" : r.plan ? "Pack" : "",
      r.status.label, r.status.detail ?? "",
      String(r.attended), r.lastClassDate ?? "", r.stripe ? String(Math.round(r.stripe.totalSpent)) : "",
    ]);
    const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = "clientes-estado.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center gap-[9px] flex-wrap">
        <SearchInputV2 value={search} onChange={changeSearch} placeholder="Buscar por nombre, email o plan…" className="min-w-[160px] flex-1" />
        <IconButtonV2 onClick={downloadCsv} title="Exportar a CSV">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
          </svg>
        </IconButtonV2>
      </div>

      <div className="mt-3">
        <FilterPillGroupV2
          active={filter}
          onChange={changeFilter}
          options={[
            { key: "all", label: "Todos" },
            { key: "duplicadas", label: "2+ suscripciones", count: counts.duplicadas || undefined, countTone: "danger" },
            { key: "activa", label: "Al día" },
            { key: "pack", label: "Packs" },
            { key: "congelada", label: "Congeladas", count: counts.congelada || undefined, countTone: "warning" },
            { key: "sin_plan", label: "Sin plan", count: counts.sin_plan || undefined, countTone: "warning" },
            { key: "inactivo", label: "Inactivos", count: counts.inactivo || undefined, countTone: "warning" },
            { key: "error", label: "Error de pago", count: counts.error || undefined, countTone: "danger" },
          ]}
        />
      </div>

      <div className={`mt-[20px] ${tableCardClassV2}`}>
        <div className="hidden sm:block">
          <div className={tableHeadClassV2} style={gridColsV2(COLS)}>
            <span className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("name")}>
              Cliente<SortArrow active={sortKey === "name"} dir={sortDir} />
            </span>
            <span>Plan</span>
            <span>Estado</span>
            <span className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("lastClass")}>
              Última clase<SortArrow active={sortKey === "lastClass"} dir={sortDir} />
            </span>
            <span className="flex items-center cursor-pointer select-none" onClick={() => toggleSort("totalSpent")}>
              Total<SortArrow active={sortKey === "totalSpent"} dir={sortDir} />
            </span>
          </div>
        </div>

        {pageRows.length === 0 ? (
          <div className="py-12 text-center text-faint text-sm">No hay clientes que coincidan.</div>
        ) : (
          pageRows.map((r) => {
            const pb = planBadge(r.plan);
            return (
              <div key={r.id}>
                {/* Escritorio */}
                <div className="hidden sm:block">
                  <div onClick={() => setSelected(r)} className={`${tableRowClassV2} cursor-pointer`} style={gridColsV2(COLS)}>
                    <div className="flex items-center gap-[11px] min-w-0">
                      <Avatar seed={r.id} initials={initials(r.name, r.email)} size={30} />
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-navy truncate">{r.name}</p>
                        {r.email && <p className="text-[12px] text-faint truncate">{r.email}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-block px-[11px] py-1 rounded-[8px] text-[12.5px] font-medium whitespace-nowrap ${pb.cls}`}>{pb.label}</span>
                      {r.activeSubCount >= 2 && (
                        <span title="Tiene varias suscripciones activas a la vez — posible doble cobro. Revísalo en Momence."
                          className="inline-flex items-center gap-1 px-[7px] py-[2px] rounded-full text-[11px] font-semibold bg-danger/10 text-danger whitespace-nowrap">
                          ⚠ {r.activeSubCount} suscr.
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className={`inline-flex items-center gap-[7px] rounded-full px-[10px] py-[3px] text-[12.5px] font-medium whitespace-nowrap ${TONE_CLS[r.status.tone]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[r.status.tone]}`} />
                        {r.status.label}
                      </span>
                      {r.status.detail && <p className="text-[11px] text-faint mt-0.5 truncate">{r.status.detail}</p>}
                    </div>
                    <div className="text-[13px] text-muted">{r.lastClassDate ? timeAgo(r.lastClassDate) : "-"}</div>
                    <div>
                      <p className="text-[14px] font-semibold text-navy tabular-nums">{r.stripe ? fmt(r.stripe.totalSpent) : "-"}</p>
                      {r.attended > 0 && <p className="text-[11px] text-faint">{r.attended} clases</p>}
                    </div>
                  </div>
                </div>

                {/* Móvil */}
                <div onClick={() => setSelected(r)} className="sm:hidden flex items-center gap-[10px] py-[10px] border-t border-subtle cursor-pointer active:bg-subtle">
                  <Avatar seed={r.id} initials={initials(r.name, r.email)} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-navy truncate">{r.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-block px-[7px] py-[1px] rounded-[6px] text-[11px] font-medium whitespace-nowrap ${pb.cls}`}>{pb.label}</span>
                      {r.activeSubCount >= 2 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger whitespace-nowrap">⚠ {r.activeSubCount} suscr.</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted whitespace-nowrap">
                          <span className={`w-[5px] h-[5px] rounded-full shrink-0 ${TONE_DOT[r.status.tone]}`} />
                          {r.status.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold text-navy tabular-nums">{r.stripe ? fmt(r.stripe.totalSpent) : "-"}</p>
                    <p className="text-[11px] text-faint">{r.lastClassDate ? timeAgo(r.lastClassDate) : "sin clases"}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <TablePaginationV2 page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {selected && (
        <MemberDrawer client={selected} payments={payments} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
