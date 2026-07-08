import type { Category } from "@/lib/categories";
import type { Contact, ContactStats } from "@/app/transacciones/actions";
import { CategoryBadge } from "@/app/transacciones/TransaccionesList";
import Avatar from "@/app/components/Avatar";
import SearchInputV2 from "@/app/components/v2/SearchInputV2";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import { PrimaryButtonV2 } from "@/app/components/v2/ButtonsV2";
import TaxBadgeV2 from "@/app/components/v2/TaxBadgeV2";
import { tableHeadClassV2, tableRowClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import { knownDomain, initials, fmtDate as fmtContactDate } from "./ContactosManager";

const COLS = "2fr 1.3fr .6fr .6fr .7fr .8fr";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  rows: Contact[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  categories: Category[];
  contactStats: Record<number, ContactStats>;
  onRowClick: (id: number) => void;
  onNewContact: () => void;
  onRecompute: () => void;
  recomputing: boolean;
  recomputed: number | null;
};

export default function ContactosManagerV2({
  search, onSearchChange, rows, totalCount, page, pageSize, onPageChange,
  categories, contactStats, onRowClick, onNewContact, onRecompute, recomputing, recomputed,
}: Props) {
  return (
    <div>
      <div className="flex items-center gap-[10px]">
        <SearchInputV2 value={search} onChange={onSearchChange} placeholder="Buscar contacto…" className="flex-1" />
        <button
          type="button"
          onClick={onRecompute}
          disabled={recomputing}
          title="Vuelve a calcular Contacto a partir de Concepto + Más datos, cruzando con los contactos guardados"
          className="flex items-center gap-[7px] border border-[#e6e6ea] rounded-[10px] px-[13px] py-2.5 text-[13.5px] font-medium text-[#3f3f46] bg-white hover:bg-[#18181b]/[0.02] transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 11a8 8 0 0 0-14-4M4 5v3h3" /><path d="M4 13a8 8 0 0 0 14 4M20 19v-3h-3" />
          </svg>
          {recomputing ? "Recalculando…" : recomputed !== null ? `${recomputed} actualizados` : "Recalcular"}
        </button>
        <PrimaryButtonV2 onClick={onNewContact} className="flex items-center gap-[7px]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Nuevo contacto
        </PrimaryButtonV2>
      </div>

      <div className="mt-[24px]">
        <div className={tableHeadClassV2} style={gridColsV2(COLS)}>
          <span>Nombre</span>
          <span>Categoría</span>
          <span>IVA</span>
          <span>IRPF</span>
          <span>Movim.</span>
          <span className="text-right">Últ. mov.</span>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-[#a1a1aa] text-sm">Ningún contacto coincide con la búsqueda.</div>
        ) : (
          rows.map((c) => {
            const stats = contactStats[c.id];
            const lastDate = stats?.latest?.[0]?.date;
            const bothMissing = !(c.ivaRate > 0) && !(c.retencionRate > 0);
            return (
              <div
                key={c.id}
                onClick={() => onRowClick(c.id)}
                className={`${tableRowClassV2} cursor-pointer`}
                style={gridColsV2(COLS)}
              >
                <div className="flex items-center gap-[11px] min-w-0">
                  <Avatar seed={c.label} initials={initials(c.label)} logoDomain={knownDomain(c.label)} size={30} />
                  <p className="text-[13.5px] font-medium text-[#18181b] truncate">{c.label}</p>
                </div>
                <div><CategoryBadge category={c.category} categories={categories} /></div>
                <div><TaxBadgeV2 value={c.ivaRate} isError={bothMissing} /></div>
                <div><TaxBadgeV2 value={c.retencionRate} isError={bothMissing} /></div>
                <p className="text-[13px] font-semibold text-[#18181b]">{stats?.count ?? "—"}</p>
                <p className="text-right text-[12.5px] text-[#71717a]">{lastDate ? fmtContactDate(lastDate) : "—"}</p>
              </div>
            );
          })
        )}
        {rows.length > 0 && (
          <TablePaginationV2 page={page} totalItems={totalCount} pageSize={pageSize} onPageChange={onPageChange} />
        )}
      </div>
    </div>
  );
}
