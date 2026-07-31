"use client";

import { useMemo, useState } from "react";
import Avatar from "@/app/components/Avatar";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import { tableHeadClassV2, tableRowClassV2, tableCardClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { normalizeText } from "@/lib/normalizeText";
import { initials, fmtDate, timeAgo } from "./ClientesTable";
import type { ClientActivityV2 } from "@/lib/clientActivityV2";

const COLS = "2.2fr .7fr 1fr 1.5fr .7fr 1.1fr";
const PAGE_SIZE = 25;
type Filter = "all" | "free";

export default function ClientesActividad({ data }: { data: ClientActivityV2 | null }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    const q = normalizeText(search.trim());
    return rows.filter((r) => {
      if (filter === "free" && r.coverage !== "none") return false;
      if (!q) return true;
      return normalizeText(`${r.name} ${r.email ?? ""}`).includes(q);
    });
  }, [data, search, filter]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function changeFilter(f: Filter) { setFilter(f); setPage(0); }
  function changeSearch(v: string) { setSearch(v); setPage(0); }

  if (!data || !data.hasData) {
    return (
      <div className="py-12 text-center text-faint text-sm">
        Aún no hay asistencia capturada de Momence. Aplica la migración 027 y ejecuta el backfill
        (scripts/backfill-attendance-v2.mjs).
      </div>
    );
  }

  return (
    <div>
      {/* Resumen */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-4 text-[13px]">
        <span className="text-muted">
          <b className="text-navy font-semibold">{data.totalWithAttendance}</b> clientes con asistencia
        </span>
        <span className="text-muted">
          <b className="text-[#b45309] dark:text-[#e8a572] font-semibold">{data.freeCount}</b> sin pago detectado
          <span className="text-faint"> · {data.freeClasses} clases</span>
        </span>
      </div>

      <div className="flex items-center gap-[9px] flex-wrap">
        <SearchInputV2 value={search} onChange={changeSearch} placeholder="Buscar por nombre o email…" className="min-w-[160px] flex-1" />
        <FilterPillGroupV2
          active={filter}
          onChange={changeFilter}
          options={[
            { key: "all", label: "Todos" },
            { key: "free", label: "Sin pago detectado", count: data.freeCount, countTone: "warning" },
          ]}
        />
      </div>

      {filter === "free" && (
        <p className="mt-2 text-[12px] text-faint">
          Han asistido a clase sin que encontremos pago (ni Stripe ni membresía/pack de Momence). Ojo:
          quien paga en efectivo o entra por Urban puede aparecer aquí sin ser gratis — revisa antes de actuar.
        </p>
      )}

      <div className={`mt-[20px] ${tableCardClassV2}`}>
        <div className="hidden sm:block">
          <div className={tableHeadClassV2} style={gridColsV2(COLS)}>
            <span>Cliente</span>
            <span>Clases</span>
            <span>Última clase</span>
            <span>1ª clase</span>
            <span>No-shows</span>
            <span>Pago</span>
          </div>
        </div>

        {pageRows.length === 0 ? (
          <div className="py-12 text-center text-faint text-sm">No hay clientes que coincidan.</div>
        ) : (
          pageRows.map((r) => (
            <div key={r.memberId}>
              {/* Escritorio */}
              <div className="hidden sm:block">
                <div className={tableRowClassV2} style={gridColsV2(COLS)}>
                  <div className="flex items-center gap-[11px] min-w-0">
                    <Avatar seed={String(r.memberId)} initials={initials(r.name, r.email)} size={30} />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-navy truncate">{r.name}</p>
                      {r.email && <p className="text-[12px] text-faint truncate">{r.email}</p>}
                    </div>
                  </div>
                  <div className="text-[14px] font-semibold text-navy tabular-nums">{r.attended}</div>
                  <div className="text-[13px] text-muted">{r.lastDate ? timeAgo(r.lastDate) : "-"}</div>
                  <div className="text-[13px] text-muted">
                    {r.firstDate ? fmtDate(r.firstDate) : "-"}
                    {r.firstTeacher && <span className="block text-[11px] text-faint truncate">{r.firstTeacher}</span>}
                  </div>
                  <div className={`text-[13px] tabular-nums ${r.noShows > 0 ? "text-navy/60" : "text-faint"}`}>{r.noShows}</div>
                  <div>
                    {r.coverage === "paid" ? (
                      <span className="inline-flex items-center gap-[7px] text-[12.5px] text-muted">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-success" />
                        Con pago
                      </span>
                    ) : r.coverage === "urban" ? (
                      <span className="inline-flex items-center gap-[7px] text-[12.5px] text-muted">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#3b82f6]" />
                        Urban
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-[7px] rounded-full px-[10px] py-[3px] text-[12px] font-medium bg-[#b45309]/10 text-[#b45309] dark:text-[#e8a572] whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#b45309] dark:bg-[#e8a572]" />
                        Sin pago detectado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Móvil */}
              <div className="sm:hidden flex items-center gap-[10px] py-[10px] border-t border-subtle">
                <Avatar seed={String(r.memberId)} initials={initials(r.name, r.email)} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-navy truncate">{r.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted">
                    <span>{r.attended} clases</span>
                    {r.lastDate && <span className="text-faint">· {timeAgo(r.lastDate)}</span>}
                  </div>
                </div>
                {r.coverage === "none" && (
                  <span className="shrink-0 rounded-full px-[8px] py-[2px] text-[11px] font-medium bg-[#b45309]/10 text-[#b45309] dark:text-[#e8a572] whitespace-nowrap">
                    Sin pago
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <TablePaginationV2 page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
