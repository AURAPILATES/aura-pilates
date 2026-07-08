import type { Category } from "@/lib/categories";
import type { Contact } from "./actions";
import type { PendingSeriesRow, ConfirmedExpenseRow, ContactPick } from "./RecurrentesList";
import { fmtEUR, pickToLabel } from "./RecurrentesList";
import { CategoryBadge } from "./TransaccionesList";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import TaxBadgeV2 from "@/app/components/v2/TaxBadgeV2";
import { tableHeadClassV2, tableRowClassV2, tableGroupClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";

const COLS = "2.2fr 1.4fr .85fr 1.1fr .9fr 1fr";

type Props = {
  pending: PendingSeriesRow[];
  confirmed: ConfirmedExpenseRow[];
  confirmedPageRows: ConfirmedExpenseRow[];
  categories: Category[];
  contacts: Contact[];
  pickFor: (row: PendingSeriesRow) => ContactPick;
  ivaRateFor: (row: PendingSeriesRow) => number;
  retencionRateFor: (row: PendingSeriesRow) => number;
  onOpenPending: (row: PendingSeriesRow) => void;
  onOpenConfirmed: (row: ConfirmedExpenseRow) => void;
  onConfirmRow: (row: PendingSeriesRow) => Promise<void>;
  confirmedPage: number;
  pageSize: number;
  onConfirmedPageChange: (p: number) => void;
};

export default function RecurrentesListV2({
  pending, confirmed, confirmedPageRows, categories, contacts, pickFor, ivaRateFor, retencionRateFor,
  onOpenPending, onOpenConfirmed, onConfirmRow, confirmedPage, pageSize, onConfirmedPageChange,
}: Props) {
  return (
    <div className="mt-[24px]">
      <div className={tableHeadClassV2} style={gridColsV2(COLS)}>
        <span>Concepto</span>
        <span>Categoría</span>
        <span>Periodo</span>
        <span>IVA / Ret</span>
        <span className="text-right">Importe</span>
        <span className="text-right">Estado</span>
      </div>

      {pending.length > 0 && (
        <>
          <div className={tableGroupClassV2}>
            <span className="flex items-center gap-2">
              <span className="w-[7px] h-[7px] rounded-full bg-[#b45309]" />
              POR CONFIRMAR
            </span>
            <span className="text-[#a1a1aa] font-normal normal-case">{pending.length}</span>
          </div>
          {pending.map((row) => {
            const pick = pickFor(row);
            const linked = !!pick;
            const ivaRate = ivaRateFor(row);
            const retRate = retencionRateFor(row);
            return (
              <div
                key={row.keys[0]}
                onClick={() => onOpenPending(row)}
                className={`${tableRowClassV2} cursor-pointer`}
                style={gridColsV2(COLS)}
              >
                <p className="text-[13.5px] font-medium text-[#18181b] truncate">{row.label}</p>
                <div>{row.category && <CategoryBadge category={row.category} categories={categories} />}</div>
                <p className="text-[12.5px] text-[#71717a] capitalize">{row.period}</p>
                <div className="flex items-center gap-1.5">
                  <TaxBadgeV2 value={ivaRate} isError={false} />
                  <TaxBadgeV2 value={retRate} isError={false} />
                </div>
                <p className="text-right text-[13.5px] font-semibold text-[#18181b]">{fmtEUR(Math.abs(row.amount))}</p>
                <div className="flex justify-end">
                  {linked ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void onConfirmRow(row); }}
                      title={`Vinculado a ${pickToLabel(pick, contacts)}`}
                      className="inline-flex items-center gap-1.5 bg-[#fef3e2] text-[#b45309] rounded-full px-[11px] py-1 text-[12px] font-semibold whitespace-nowrap hover:bg-[#fce8c8] transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l4 4 10-10" />
                      </svg>
                      Confirmar
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-[#f2f2f4] text-[#71717a] rounded-full px-[11px] py-1 text-[12px] font-medium whitespace-nowrap">
                      Sin vincular
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      <div className={tableGroupClassV2}>
        <span className="flex items-center gap-2">
          <span className="w-[7px] h-[7px] rounded-full bg-[#16a34a]" />
          ACTIVOS
        </span>
        <span className="text-[#a1a1aa] font-normal normal-case">{confirmed.length}</span>
      </div>
      {confirmed.length === 0 ? (
        <p className="text-sm text-[#a1a1aa] py-6">Sin gastos recurrentes confirmados todavía.</p>
      ) : (
        confirmedPageRows.map((row) => {
          const e = row.expense;
          const bothMissing = !(e.iva_rate > 0) && !(e.retencion_rate > 0);
          return (
            <div
              key={e.id}
              onClick={() => onOpenConfirmed(row)}
              className={`${tableRowClassV2} cursor-pointer`}
              style={gridColsV2(COLS)}
            >
              <p className="text-[13.5px] font-medium text-[#18181b] truncate">{e.label}</p>
              <div>{e.category && <CategoryBadge category={e.category} categories={categories} />}</div>
              <p className="text-[12.5px] text-[#71717a] capitalize">{e.period}</p>
              <div className="flex items-center gap-1.5">
                <TaxBadgeV2 value={e.iva_rate} isError={bothMissing} />
                <TaxBadgeV2 value={e.retencion_rate} isError={bothMissing} />
              </div>
              <p className="text-right text-[13.5px] font-semibold text-[#18181b]">{fmtEUR(Math.abs(e.amount))}</p>
              <div className="flex justify-end">
                <span className="inline-flex items-center gap-1.5 text-[#16a34a] text-[12.5px] font-medium whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                  Activo
                </span>
              </div>
            </div>
          );
        })
      )}
      {confirmed.length > 0 && (
        <TablePaginationV2 page={confirmedPage} totalItems={confirmed.length} pageSize={pageSize} onPageChange={onConfirmedPageChange} />
      )}
    </div>
  );
}
