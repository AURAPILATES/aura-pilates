"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import {
  periodKeyOf,
  periodLabelOf,
  type Granularity,
  type StatementData,
  type StatementCatMeta,
} from "@/lib/previsiones";

// ── Formato ───────────────────────────────────────────────────────────────────

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("es-ES")} €`;
const fmtSigned = (n: number) =>
  `${n >= 0 ? "+" : "−"}${Math.round(Math.abs(n)).toLocaleString("es-ES")} €`;

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

// ── Reagrupación mes → período seleccionado ───────────────────────────────────

type RolledRow = { key: string; label: string; color: string; byPeriod: Record<string, number>; total: number };
type Rolled = {
  periods: { key: string; label: string }[];
  currentPeriod: string;
  incomeRows: RolledRow[];
  expenseRows: RolledRow[];
  incomeTotal: Record<string, number>;
  expenseTotal: Record<string, number>;
  resultado: Record<string, number>;
  saldoInicial: Record<string, number>;
  saldoFinal: Record<string, number>;
  grandIncome: number;
  grandExpense: number;
};

function rollup(data: StatementData, g: Granularity): Rolled {
  // Períodos únicos en orden cronológico.
  const seen = new Set<string>();
  const periods: { key: string; label: string }[] = [];
  for (const m of data.months) {
    const k = periodKeyOf(m, g);
    if (!seen.has(k)) {
      seen.add(k);
      periods.push({ key: k, label: periodLabelOf(k, g) });
    }
  }

  function rollRows(
    cats: StatementCatMeta[],
    byCat: Record<string, Record<string, number>>,
  ): RolledRow[] {
    return cats.map((c) => {
      const byPeriod: Record<string, number> = {};
      let total = 0;
      const months = byCat[c.key] ?? {};
      for (const [m, v] of Object.entries(months)) {
        const k = periodKeyOf(m, g);
        byPeriod[k] = (byPeriod[k] ?? 0) + v;
        total += v;
      }
      return { key: c.key, label: c.label, color: c.color, byPeriod, total };
    });
  }

  const incomeRows = rollRows(data.incomeCats, data.incomeByCat);
  const expenseRows = rollRows(data.expenseCats, data.expenseByCat);

  const incomeTotal: Record<string, number> = {};
  const expenseTotal: Record<string, number> = {};
  const resultado: Record<string, number> = {};
  const saldoInicial: Record<string, number> = {};
  const saldoFinal: Record<string, number> = {};

  for (const { key: p } of periods) {
    incomeTotal[p] = incomeRows.reduce((s, r) => s + (r.byPeriod[p] ?? 0), 0);
    expenseTotal[p] = expenseRows.reduce((s, r) => s + (r.byPeriod[p] ?? 0), 0);
    resultado[p] = incomeTotal[p] - expenseTotal[p];
  }

  let prev = data.openingBalance;
  for (const { key: p } of periods) {
    saldoInicial[p] = prev;
    saldoFinal[p] = prev + resultado[p];
    prev = saldoFinal[p];
  }

  return {
    periods,
    currentPeriod: periodKeyOf(CURRENT_MONTH, g),
    incomeRows,
    expenseRows,
    incomeTotal,
    expenseTotal,
    resultado,
    saldoInicial,
    saldoFinal,
    grandIncome: Object.values(incomeTotal).reduce((s, v) => s + v, 0),
    grandExpense: Object.values(expenseTotal).reduce((s, v) => s + v, 0),
  };
}

// ── Clases de celda compartidas ───────────────────────────────────────────────

const LABEL_CELL = "sticky left-0 z-10 px-3 sm:px-4 text-left w-[178px] min-w-[178px] sm:w-[220px] sm:min-w-[220px]";
const NUM_CELL = "px-3 py-[7px] text-right tabular-nums whitespace-nowrap w-[96px] min-w-[96px]";
const TOTAL_CELL = "px-3 py-[7px] text-right tabular-nums whitespace-nowrap w-[112px] min-w-[112px] border-l border-border bg-subtle/60";

// ── Componente ────────────────────────────────────────────────────────────────

export default function PrevisionesHistorico({ statement }: { statement: StatementData }) {
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [showIncome, setShowIncome] = useState(true);
  const [showExpense, setShowExpense] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const r = useMemo(() => rollup(statement, granularity), [statement, granularity]);

  // Al cambiar de granularidad (o al montar) desplaza el scroll al período más reciente.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [granularity]);

  const hasData = r.periods.length > 0;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <p className="text-[13px] text-muted max-w-[520px]">
          Histórico de ingresos y gastos <b className="text-navy font-medium">en bruto</b>, desglosado
          por categoría según el banco. Traspasos internos excluidos.
        </p>
        <FilterPillGroupV2
          active={granularity}
          onChange={setGranularity}
          options={[
            { key: "month", label: "Mes" },
            { key: "quarter", label: "Trimestre" },
            { key: "year", label: "Año" },
          ]}
        />
      </div>

      {!hasData ? (
        <div className="bg-card border border-border rounded-[14px] py-16 text-center text-faint text-sm">
          Sin movimientos que mostrar.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-[14px] overflow-hidden">
          <div ref={scrollRef} className="overflow-x-auto">
            <table className="border-collapse text-[12px]" style={{ minWidth: `${220 + r.periods.length * 96 + 112}px` }}>
              <thead>
                <tr className="border-b border-border">
                  <th className={`${LABEL_CELL} py-[9px] bg-card`} />
                  {r.periods.map((p) => (
                    <th
                      key={p.key}
                      className={`${NUM_CELL} py-[9px] text-[10.5px] font-semibold uppercase tracking-wide ${
                        p.key === r.currentPeriod ? "text-navy bg-primary/[0.05]" : "text-faint"
                      }`}
                    >
                      {p.label}
                    </th>
                  ))}
                  <th className={`${TOTAL_CELL} py-[9px] text-[10.5px] font-semibold uppercase tracking-wide text-strong`}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Saldo inicial */}
                <SummaryRow
                  label="Saldo inicial"
                  periods={r.periods}
                  currentPeriod={r.currentPeriod}
                  valueFor={(p) => r.saldoInicial[p]}
                  totalValue={r.saldoInicial[r.periods[0].key]}
                  format={(v) => fmtEur(v)}
                  colorFor={(v) => (v < 0 ? "text-[#b53e0d] dark:text-[#e69675]" : "text-muted")}
                  tone="muted"
                />

                {/* ── INGRESOS ── */}
                <SectionHeaderRow
                  label="Ingresos"
                  open={showIncome}
                  onToggle={() => setShowIncome((v) => !v)}
                  periods={r.periods}
                  currentPeriod={r.currentPeriod}
                  totalByPeriod={r.incomeTotal}
                  grand={r.grandIncome}
                  colorClass="text-[#0d8037] dark:text-[#78e39f]"
                  sign="+"
                />
                {showIncome &&
                  r.incomeRows.map((row) => (
                    <CategoryRow key={row.key} row={row} periods={r.periods} currentPeriod={r.currentPeriod} />
                  ))}

                {/* ── GASTOS ── */}
                <SectionHeaderRow
                  label="Gastos"
                  open={showExpense}
                  onToggle={() => setShowExpense((v) => !v)}
                  periods={r.periods}
                  currentPeriod={r.currentPeriod}
                  totalByPeriod={r.expenseTotal}
                  grand={r.grandExpense}
                  colorClass="text-[#b53e0d] dark:text-[#e69675]"
                  sign="−"
                />
                {showExpense &&
                  r.expenseRows.map((row) => (
                    <CategoryRow key={row.key} row={row} periods={r.periods} currentPeriod={r.currentPeriod} />
                  ))}

                {/* ── Resultado ── */}
                <SummaryRow
                  label="Resultado"
                  periods={r.periods}
                  currentPeriod={r.currentPeriod}
                  valueFor={(p) => r.resultado[p]}
                  totalValue={r.grandIncome - r.grandExpense}
                  format={(v) => fmtSigned(v)}
                  colorFor={(v) => (v >= 0 ? "text-[#0d8037] dark:text-[#78e39f]" : "text-[#b53e0d] dark:text-[#e69675]")}
                  tone="strong"
                  topBorder
                />

                {/* ── Saldo final ── */}
                <SummaryRow
                  label="Saldo final"
                  periods={r.periods}
                  currentPeriod={r.currentPeriod}
                  valueFor={(p) => r.saldoFinal[p]}
                  totalValue={r.saldoFinal[r.periods[r.periods.length - 1].key]}
                  format={(v) => fmtEur(v)}
                  colorFor={(v) => (v < 0 ? "text-[#b53e0d] dark:text-[#e69675]" : "text-navy")}
                  tone="bold"
                />
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filas ─────────────────────────────────────────────────────────────────────

function CategoryRow({
  row,
  periods,
  currentPeriod,
}: {
  row: RolledRow;
  periods: { key: string; label: string }[];
  currentPeriod: string;
}) {
  return (
    <tr className="border-t border-subtle hover:bg-subtle/50">
      <td className={`${LABEL_CELL} py-[7px] bg-card`}>
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: row.color }} />
          <span className="text-[12.5px] text-muted truncate">{row.label}</span>
        </span>
      </td>
      {periods.map((p) => {
        const v = row.byPeriod[p.key];
        return (
          <td
            key={p.key}
            className={`${NUM_CELL} text-navy/80 ${p.key === currentPeriod ? "bg-primary/[0.04]" : ""}`}
          >
            {v ? fmtEur(v) : <span className="text-faint">-</span>}
          </td>
        );
      })}
      <td className={`${TOTAL_CELL} font-medium text-navy`}>{row.total ? fmtEur(row.total) : <span className="text-faint">-</span>}</td>
    </tr>
  );
}

function SectionHeaderRow({
  label,
  open,
  onToggle,
  periods,
  currentPeriod,
  totalByPeriod,
  grand,
  colorClass,
  sign,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  periods: { key: string; label: string }[];
  currentPeriod: string;
  totalByPeriod: Record<string, number>;
  grand: number;
  colorClass: string;
  sign: "+" | "−";
}) {
  return (
    <tr className="border-t border-border bg-subtle">
      <td className={`${LABEL_CELL} py-[9px] bg-subtle`}>
        <button type="button" onClick={onToggle} className="flex items-center gap-1.5 group">
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            className={`text-faint transition-transform ${open ? "" : "-rotate-90"}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span className="text-[11.5px] font-bold uppercase tracking-wide text-navy">{label}</span>
        </button>
      </td>
      {periods.map((p) => (
        <td
          key={p.key}
          className={`${NUM_CELL} py-[9px] font-bold ${colorClass} ${p.key === currentPeriod ? "bg-primary/[0.05]" : ""}`}
        >
          {sign}{fmtEur(totalByPeriod[p.key] ?? 0)}
        </td>
      ))}
      <td className={`${TOTAL_CELL} py-[9px] font-bold ${colorClass}`}>{sign}{fmtEur(grand)}</td>
    </tr>
  );
}

function SummaryRow({
  label,
  periods,
  currentPeriod,
  valueFor,
  totalValue,
  format,
  colorFor,
  tone,
  topBorder,
}: {
  label: string;
  periods: { key: string; label: string }[];
  currentPeriod: string;
  valueFor: (period: string) => number;
  totalValue: number;
  format: (v: number) => string;
  colorFor: (v: number) => string;
  tone: "muted" | "strong" | "bold";
  topBorder?: boolean;
}) {
  const labelWeight = tone === "bold" ? "font-bold text-navy" : tone === "strong" ? "font-semibold text-navy" : "font-medium text-muted";
  const valWeight = tone === "bold" ? "font-bold" : tone === "strong" ? "font-semibold" : "font-medium";
  const rowBg = tone === "muted" ? "bg-card" : "bg-subtle";
  return (
    <tr className={`${topBorder ? "border-t-2" : "border-t"} border-border ${rowBg}`}>
      <td className={`${LABEL_CELL} py-[9px] ${rowBg} ${labelWeight} text-[12px]`}>{label}</td>
      {periods.map((p) => {
        const v = valueFor(p.key);
        return (
          <td
            key={p.key}
            className={`${NUM_CELL} py-[9px] ${valWeight} ${colorFor(v)} ${p.key === currentPeriod ? "bg-primary/[0.05]" : ""}`}
          >
            {format(v)}
          </td>
        );
      })}
      <td className={`${TOTAL_CELL} py-[9px] ${valWeight} ${colorFor(totalValue)}`}>{format(totalValue)}</td>
    </tr>
  );
}
