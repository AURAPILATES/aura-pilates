"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import Drawer from "@/app/components/Drawer";
import {
  periodKeyOf,
  periodLabelOf,
  INTERNAL_KEY,
  type Granularity,
  type StatementData,
  type StatementCatMeta,
  type StatementTxn,
} from "@/lib/previsiones";
import type { EconomicGroup } from "@/lib/economicGroups";

// ── Grupos económicos (mismos label/color/orden que "Desglose de gastos" en Analítica) ──

const GROUP_LABELS: Record<EconomicGroup, string> = {
  personal: "Personal",
  operational: "Operativo",
  financiacion: "Financiación",
  capex: "Inversión",
};
const GROUP_COLORS: Record<EconomicGroup, string> = {
  personal: "#3A56C5",
  operational: "#1E8C5A",
  financiacion: "#8878C0",
  capex: "#D4621A",
};
const GROUP_ORDER: EconomicGroup[] = ["personal", "operational", "financiacion", "capex"];

// ── Formato ───────────────────────────────────────────────────────────────────

// "de-DE" agrupa millares de forma consistente desde 1.000 (es-ES solo lo hace desde 5 cifras).
const fmtEur = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;
const fmtSigned = (n: number) => `${n >= 0 ? "+" : "−"}${Math.round(Math.abs(n)).toLocaleString("de-DE")} €`;
const fmtSaldo = (n: number) => `${n < 0 ? "−" : ""}${Math.round(Math.abs(n)).toLocaleString("de-DE")} €`;
const fmtDate = (d: string) => d.split("-").reverse().join("/");

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
const GREEN = "text-[#0d8037] dark:text-[#78e39f]";
const RED = "text-[#b53e0d] dark:text-[#e69675]";

// ── Reagrupación mes → período seleccionado ───────────────────────────────────

type RolledRow = { key: string; label: string; color: string; group?: EconomicGroup; byPeriod: Record<string, number>; total: number };
type ExpenseGroup = { group: EconomicGroup; rows: RolledRow[]; totalByPeriod: Record<string, number>; grand: number };
type Rolled = {
  periods: { key: string; label: string }[];
  currentPeriod: string;
  incomeRows: RolledRow[];
  expenseGroups: ExpenseGroup[];
  incomeTotal: Record<string, number>;
  expenseTotal: Record<string, number>;
  resultado: Record<string, number>;
  saldoInicial: Record<string, number>;
  saldoFinal: Record<string, number>;
  transferByPeriod: Record<string, number>;
  grandIncome: number;
  grandExpense: number;
};

function rollup(data: StatementData, g: Granularity): Rolled {
  const seen = new Set<string>();
  const periods: { key: string; label: string }[] = [];
  for (const m of data.months) {
    const k = periodKeyOf(m, g);
    if (!seen.has(k)) {
      seen.add(k);
      periods.push({ key: k, label: periodLabelOf(k, g) });
    }
  }

  function rollRows(cats: StatementCatMeta[], byCat: Record<string, Record<string, number>>): RolledRow[] {
    return cats.map((c) => {
      const byPeriod: Record<string, number> = {};
      let total = 0;
      for (const [m, v] of Object.entries(byCat[c.key] ?? {})) {
        const k = periodKeyOf(m, g);
        byPeriod[k] = (byPeriod[k] ?? 0) + v;
        total += v;
      }
      return { key: c.key, label: c.label, color: c.color, group: c.group, byPeriod, total };
    });
  }

  const incomeRows = rollRows(data.incomeCats, data.incomeByCat);
  const expenseRowsAll = rollRows(data.expenseCats, data.expenseByCat);

  const expenseGroups: ExpenseGroup[] = [];
  for (const group of GROUP_ORDER) {
    const rows = expenseRowsAll.filter((r) => r.group === group).sort((a, b) => b.total - a.total);
    if (rows.length === 0) continue;
    const totalByPeriod: Record<string, number> = {};
    for (const { key: p } of periods) totalByPeriod[p] = rows.reduce((s, r) => s + (r.byPeriod[p] ?? 0), 0);
    expenseGroups.push({ group, rows, totalByPeriod, grand: rows.reduce((s, r) => s + r.total, 0) });
  }

  const incomeTotal: Record<string, number> = {};
  const expenseTotal: Record<string, number> = {};
  const resultado: Record<string, number> = {};
  const saldoInicial: Record<string, number> = {};
  const saldoFinal: Record<string, number> = {};
  const transferByPeriod: Record<string, number> = {};

  for (const { key: p } of periods) {
    incomeTotal[p] = incomeRows.reduce((s, r) => s + (r.byPeriod[p] ?? 0), 0);
    expenseTotal[p] = expenseGroups.reduce((s, gr) => s + (gr.totalByPeriod[p] ?? 0), 0);
    resultado[p] = incomeTotal[p] - expenseTotal[p];
    transferByPeriod[p] = 0;
  }
  for (const [m, v] of Object.entries(data.transferByMonth)) {
    const k = periodKeyOf(m, g);
    if (k in transferByPeriod) transferByPeriod[k] += v;
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
    expenseGroups,
    incomeTotal,
    expenseTotal,
    resultado,
    saldoInicial,
    saldoFinal,
    transferByPeriod,
    grandIncome: Object.values(incomeTotal).reduce((s, v) => s + v, 0),
    grandExpense: Object.values(expenseTotal).reduce((s, v) => s + v, 0),
  };
}

// ── Clases de celda ───────────────────────────────────────────────────────────

const LABEL_CELL = "sticky left-0 z-10 pr-3 text-left w-[188px] min-w-[188px] sm:w-[230px] sm:min-w-[230px]";
const NUM_CELL = "px-3 py-[7px] text-right tabular-nums whitespace-nowrap w-[98px] min-w-[98px]";
const TOTAL_CELL = "px-3 py-[7px] text-right tabular-nums whitespace-nowrap w-[112px] min-w-[112px] border-l border-border bg-subtle/60";

type DrawerState = { title: string; subtitle: string; txns: StatementTxn[] } | null;

// ── Componente ────────────────────────────────────────────────────────────────

export default function PrevisionesHistorico({ statement }: { statement: StatementData }) {
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [showIncome, setShowIncome] = useState(true);
  const [showExpense, setShowExpense] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<EconomicGroup>>(new Set());
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const r = useMemo(() => rollup(statement, granularity), [statement, granularity]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [granularity]);

  function toggleGroup(g: EconomicGroup) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  }

  // Abre el drawer con las transacciones de una fila (una o varias categorías) y período.
  // Cada clave pertenece a una sola sección (ingresos/gastos), así que no hace falta filtrar
  // por signo: se muestran todos sus movimientos, incluidos abonos/reembolsos que ajustan el neto.
  function openTxns(label: string, keys: string[], period: string | null) {
    const out: StatementTxn[] = [];
    for (const k of keys) {
      for (const t of statement.txnsByKey[k] ?? []) {
        if (period && periodKeyOf(t.date.slice(0, 7), granularity) !== period) continue;
        out.push(t);
      }
    }
    out.sort((a, b) => b.date.localeCompare(a.date));
    const periodLabel = period ? r.periods.find((p) => p.key === period)?.label ?? "" : "Todo el histórico";
    const sum = out.reduce((s, t) => s + Math.abs(t.amount), 0);
    setDrawer({ title: label, subtitle: `${periodLabel} · ${out.length} mov. · ${fmtEur(sum)}`, txns: out });
  }

  const incomeKeys = r.incomeRows.map((row) => row.key);
  const allExpenseKeys = r.expenseGroups.flatMap((gr) => gr.rows.map((row) => row.key));
  const hasData = r.periods.length > 0;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <p className="text-[13px] text-muted max-w-[520px]">
          Histórico de ingresos y gastos <b className="text-navy font-medium">en bruto</b>, desglosado por
          categoría según el banco. Toca cualquier celda para ver sus transacciones.
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
            <table className="border-collapse text-[12px]" style={{ minWidth: `${230 + r.periods.length * 98 + 112}px` }}>
              <thead>
                <tr className="border-b border-border">
                  <th className={`${LABEL_CELL} pl-3 sm:pl-4 py-[9px] bg-card`} />
                  {r.periods.map((p) => (
                    <th
                      key={p.key}
                      className={`${NUM_CELL} text-[10.5px] font-semibold uppercase tracking-wide ${
                        p.key === r.currentPeriod ? "text-navy bg-primary/[0.05]" : "text-faint"
                      }`}
                    >
                      {p.label}
                    </th>
                  ))}
                  <th className={`${TOTAL_CELL} text-[10.5px] font-semibold uppercase tracking-wide text-strong`}>Total</th>
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
                  format={fmtSaldo}
                  colorFor={(v) => (v < 0 ? RED : "text-muted")}
                  tone="muted"
                />

                {/* ── INGRESOS ── */}
                <SectionRow
                  label="Ingresos"
                  open={showIncome}
                  onToggle={() => setShowIncome((v) => !v)}
                  periods={r.periods}
                  currentPeriod={r.currentPeriod}
                  totalByPeriod={r.incomeTotal}
                  grand={r.grandIncome}
                  colorClass={GREEN}
                  sign="+"
                  onCell={(p) => openTxns("Ingresos", incomeKeys, p)}
                />
                {showIncome &&
                  r.incomeRows.map((row) => (
                    <LeafRow
                      key={row.key}
                      row={row}
                      periods={r.periods}
                      currentPeriod={r.currentPeriod}
                      indent="pl-8 sm:pl-9"
                      onCell={(p) => openTxns(row.label, [row.key], p)}
                    />
                  ))}

                {/* ── GASTOS ── */}
                <SectionRow
                  label="Gastos"
                  open={showExpense}
                  onToggle={() => setShowExpense((v) => !v)}
                  periods={r.periods}
                  currentPeriod={r.currentPeriod}
                  totalByPeriod={r.expenseTotal}
                  grand={r.grandExpense}
                  colorClass={RED}
                  sign="−"
                  onCell={(p) => openTxns("Gastos", allExpenseKeys, p)}
                />
                {showExpense &&
                  r.expenseGroups.map((gr) => {
                    const open = expandedGroups.has(gr.group);
                    const groupKeys = gr.rows.map((row) => row.key);
                    return (
                      <GroupFragment key={gr.group}>
                        <GroupRow
                          group={gr}
                          open={open}
                          onToggle={() => toggleGroup(gr.group)}
                          periods={r.periods}
                          currentPeriod={r.currentPeriod}
                          onCell={(p) => openTxns(GROUP_LABELS[gr.group], groupKeys, p)}
                        />
                        {open &&
                          gr.rows.map((row) => (
                            <LeafRow
                              key={row.key}
                              row={row}
                              periods={r.periods}
                              currentPeriod={r.currentPeriod}
                              indent="pl-[52px] sm:pl-[60px]"
                              onCell={(p) => openTxns(row.label, [row.key], p)}
                            />
                          ))}
                      </GroupFragment>
                    );
                  })}

                {/* ── Resultado ── */}
                <SummaryRow
                  label="Resultado"
                  periods={r.periods}
                  currentPeriod={r.currentPeriod}
                  valueFor={(p) => r.resultado[p]}
                  totalValue={r.grandIncome - r.grandExpense}
                  format={fmtSigned}
                  colorFor={(v) => (v >= 0 ? GREEN : RED)}
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
                  format={fmtSaldo}
                  colorFor={(v) => (v < 0 ? RED : "text-navy")}
                  tone="bold"
                />

                {/* ── Traspasos internos (memo, debería rondar 0) ── */}
                <SummaryRow
                  label="Traspasos internos"
                  hint="bank ↔ efectivo · no afecta al resultado"
                  periods={r.periods}
                  currentPeriod={r.currentPeriod}
                  valueFor={(p) => r.transferByPeriod[p] ?? 0}
                  totalValue={Object.values(r.transferByPeriod).reduce((s, v) => s + v, 0)}
                  format={(v) => (Math.round(v) === 0 ? "0 €" : fmtSigned(v))}
                  colorFor={(v) => (Math.round(v) === 0 ? "text-faint" : RED)}
                  tone="memo"
                  topBorder
                  onCell={(p) => openTxns("Traspasos internos", [INTERNAL_KEY], p)}
                />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drawer && (
        <Drawer title={drawer.title} subtitle={drawer.subtitle} onClose={() => setDrawer(null)}>
          {drawer.txns.length === 0 ? (
            <p className="text-sm text-navy/45 px-6 py-8">Sin transacciones en este período.</p>
          ) : (
            drawer.txns.map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3 border-b border-navy/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{t.contact || t.concept || "Sin concepto"}</p>
                  <p className="text-xs text-navy/50 mt-0.5">{fmtDate(t.date)}</p>
                </div>
                <p className={`text-sm font-semibold tabular-nums shrink-0 ${t.amount < 0 ? "text-navy" : GREEN}`}>
                  {t.amount < 0 ? "−" : "+"}{fmtEur(Math.abs(t.amount))}
                </p>
              </div>
            ))
          )}
        </Drawer>
      )}
    </div>
  );
}

function GroupFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ── Celdas numéricas (período + Total), clicables opcionalmente ────────────────

function NumCells({
  periods,
  currentPeriod,
  valueFor,
  totalValue,
  format,
  valClass,
  onCell,
}: {
  periods: { key: string; label: string }[];
  currentPeriod: string;
  valueFor: (period: string) => number;
  totalValue: number;
  format: (v: number) => string;
  valClass: string;
  onCell?: (period: string | null) => void;
}) {
  const clickable = onCell ? "cursor-pointer hover:bg-primary/[0.08]" : "";
  return (
    <>
      {periods.map((p) => (
        <td
          key={p.key}
          onClick={onCell ? () => onCell(p.key) : undefined}
          className={`${NUM_CELL} ${valClass} ${clickable} ${p.key === currentPeriod ? "bg-primary/[0.05]" : ""}`}
        >
          {format(valueFor(p.key))}
        </td>
      ))}
      <td onClick={onCell ? () => onCell(null) : undefined} className={`${TOTAL_CELL} ${valClass} ${clickable}`}>
        {format(totalValue)}
      </td>
    </>
  );
}

// ── Fila resumen / memo (Saldo, Resultado, Traspasos) ──────────────────────────

function SummaryRow({
  label,
  hint,
  periods,
  currentPeriod,
  valueFor,
  totalValue,
  format,
  colorFor,
  tone,
  topBorder,
  onCell,
}: {
  label: string;
  hint?: string;
  periods: { key: string; label: string }[];
  currentPeriod: string;
  valueFor: (period: string) => number;
  totalValue: number;
  format: (v: number) => string;
  colorFor: (v: number) => string;
  tone: "muted" | "strong" | "bold" | "memo";
  topBorder?: boolean;
  onCell?: (period: string | null) => void;
}) {
  const labelWeight =
    tone === "bold" ? "font-bold text-navy" : tone === "strong" ? "font-semibold text-navy" : tone === "memo" ? "font-medium text-faint" : "font-medium text-muted";
  const valWeight = tone === "bold" ? "font-bold" : tone === "strong" ? "font-semibold" : "font-medium";
  const rowBg = tone === "muted" || tone === "memo" ? "bg-card" : "bg-subtle";
  // Cada celda pinta su propio color según el valor.
  return (
    <tr className={`${topBorder ? "border-t-2" : "border-t"} border-border ${rowBg}`}>
      <td className={`${LABEL_CELL} pl-3 sm:pl-4 py-[9px] ${rowBg} text-[12px]`}>
        <span className={labelWeight}>{label}</span>
        {hint && <span className="ml-1.5 text-[10.5px] text-faint font-normal hidden sm:inline">· {hint}</span>}
      </td>
      {periods.map((p) => {
        const v = valueFor(p.key);
        return (
          <td
            key={p.key}
            onClick={onCell ? () => onCell(p.key) : undefined}
            className={`${NUM_CELL} ${valWeight} ${colorFor(v)} ${onCell ? "cursor-pointer hover:bg-primary/[0.08]" : ""} ${p.key === currentPeriod ? "bg-primary/[0.05]" : ""}`}
          >
            {format(v)}
          </td>
        );
      })}
      <td
        onClick={onCell ? () => onCell(null) : undefined}
        className={`${TOTAL_CELL} ${valWeight} ${colorFor(totalValue)} ${onCell ? "cursor-pointer hover:bg-primary/[0.08]" : ""}`}
      >
        {format(totalValue)}
      </td>
    </tr>
  );
}

// ── Fila de sección (Ingresos / Gastos) ────────────────────────────────────────

function SectionRow({
  label,
  open,
  onToggle,
  periods,
  currentPeriod,
  totalByPeriod,
  grand,
  colorClass,
  sign,
  onCell,
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
  onCell: (period: string | null) => void;
}) {
  return (
    <tr className="border-t border-border bg-subtle">
      <td className={`${LABEL_CELL} pl-3 sm:pl-4 py-[9px] bg-subtle`}>
        <button type="button" onClick={onToggle} className="flex items-center gap-1.5">
          <Chevron open={open} />
          <span className="text-[11.5px] font-bold uppercase tracking-wide text-navy">{label}</span>
        </button>
      </td>
      <NumCells
        periods={periods}
        currentPeriod={currentPeriod}
        valueFor={(p) => totalByPeriod[p] ?? 0}
        totalValue={grand}
        format={(v) => (v > 0 ? `${sign}${fmtEur(v)}` : "-")}
        valClass={`font-bold ${colorClass}`}
        onCell={onCell}
      />
    </tr>
  );
}

// ── Fila de grupo madre (Personal / Operativo / …) ─────────────────────────────

function GroupRow({
  group,
  open,
  onToggle,
  periods,
  currentPeriod,
  onCell,
}: {
  group: ExpenseGroup;
  open: boolean;
  onToggle: () => void;
  periods: { key: string; label: string }[];
  currentPeriod: string;
  onCell: (period: string | null) => void;
}) {
  return (
    <tr className="border-t border-subtle hover:bg-subtle/40">
      <td className={`${LABEL_CELL} pl-6 sm:pl-7 py-[7px] bg-card`}>
        <button type="button" onClick={onToggle} className="flex items-center gap-1.5 min-w-0">
          <Chevron open={open} small />
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: GROUP_COLORS[group.group] }} />
          <span className="text-[12.5px] font-semibold text-navy truncate">{GROUP_LABELS[group.group]}</span>
        </button>
      </td>
      <NumCells
        periods={periods}
        currentPeriod={currentPeriod}
        valueFor={(p) => group.totalByPeriod[p] ?? 0}
        totalValue={group.grand}
        format={(v) => (v > 0 ? fmtEur(v) : "-")}
        valClass="font-semibold text-navy"
        onCell={onCell}
      />
    </tr>
  );
}

// ── Fila hoja (categoría) ──────────────────────────────────────────────────────

function LeafRow({
  row,
  periods,
  currentPeriod,
  indent,
  onCell,
}: {
  row: RolledRow;
  periods: { key: string; label: string }[];
  currentPeriod: string;
  indent: string;
  onCell: (period: string | null) => void;
}) {
  return (
    <tr className="border-t border-subtle hover:bg-subtle/40">
      <td className={`${LABEL_CELL} ${indent} py-[7px] bg-card`}>
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: row.color }} />
          <span className="text-[12.5px] text-muted truncate">{row.label}</span>
        </span>
      </td>
      <NumCells
        periods={periods}
        currentPeriod={currentPeriod}
        valueFor={(p) => row.byPeriod[p] ?? 0}
        totalValue={row.total}
        format={(v) => (v > 0 ? fmtEur(v) : "-")}
        valClass="text-navy/80"
        onCell={onCell}
      />
    </tr>
  );
}

// ── Chevron ────────────────────────────────────────────────────────────────────

function Chevron({ open, small }: { open: boolean; small?: boolean }) {
  const s = small ? 11 : 12;
  return (
    <svg
      width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={`text-faint transition-transform ${open ? "" : "-rotate-90"}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
