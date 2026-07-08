import type { Category } from "@/lib/categories";
import type { Contact } from "./actions";
import type { PendingSeriesRow, ConfirmedExpenseRow, ContactPick } from "./RecurrentesList";
import { fmtEUR, pickToLabel } from "./RecurrentesList";
import { CategoryBadge } from "./TransaccionesList";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import { tableHeadClassV2, tableRowClassV2, tableGroupClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";

const COLS = "2.2fr 1.4fr .85fr 1fr .9fr 1fr";

type Props = {
  pending: PendingSeriesRow[];
  confirmed: ConfirmedExpenseRow[];
  confirmedPageRows: ConfirmedExpenseRow[];
  categories: Category[];
  contacts: Contact[];
  pickFor: (row: PendingSeriesRow) => ContactPick;
  onOpenPending: (row: PendingSeriesRow) => void;
  onOpenConfirmed: (row: ConfirmedExpenseRow) => void;
  confirmedPage: number;
  pageSize: number;
  onConfirmedPageChange: (p: number) => void;
};

export default function RecurrentesListV2({
  pending, confirmed, confirmedPageRows, categories, contacts, pickFor,
  onOpenPending, onOpenConfirmed, confirmedPage, pageSize, onConfirmedPageChange,
}: Props) {
  return (
    <div className="mt-[18px]">
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
            const label = pickToLabel(pick, contacts);
            return (
              <div
                key={row.keys[0]}
                onClick={() => onOpenPending(row)}
                className={`${tableRowClassV2} cursor-pointer`}
                style={gridColsV2(COLS)}
              >
                <p className="text-[13.5px] font-semibold text-[#18181b] truncate">{row.label}</p>
                <div>{row.category && <CategoryBadge category={row.category} categories={categories} />}</div>
                <p className="text-[12.5px] text-[#71717a] capitalize">{row.period}</p>
                <p className="text-[12.5px] text-[#a1a1aa]">
                  {pick ? "según contacto" : "sin vincular"}
                </p>
                <p className="text-right text-[13.5px] font-semibold text-[#18181b]">{fmtEUR(Math.abs(row.amount))}</p>
                <div className="flex justify-end">
                  <span className="inline-flex items-center gap-1.5 bg-[#fef3e2] text-[#b45309] rounded-full px-[11px] py-1 text-[12px] font-semibold whitespace-nowrap">
                    {pick ? `${label}` : "Vincular"}
                  </span>
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
          return (
            <div
              key={e.id}
              onClick={() => onOpenConfirmed(row)}
              className={`${tableRowClassV2} cursor-pointer`}
              style={gridColsV2(COLS)}
            >
              <p className="text-[13.5px] font-semibold text-[#18181b] truncate">{e.label}</p>
              <div>{e.category && <CategoryBadge category={e.category} categories={categories} />}</div>
              <p className="text-[12.5px] text-[#71717a] capitalize">{e.period}</p>
              <p className="text-[12.5px] text-[#a1a1aa]">IVA {e.iva_rate}% / Ret {e.retencion_rate}%</p>
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
