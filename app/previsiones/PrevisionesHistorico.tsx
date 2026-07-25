"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import FilterPillGroupV2 from "@/app/components/v2/FilterPillGroupV2";
import Drawer from "@/app/components/Drawer";
import {
  periodKeyOf,
  periodLabelOf,
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

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;
const fmtSigned = (n: number) => `${n >= 0 ? "+" : "−"}${Math.round(Math.abs(n)).toLocaleString("de-DE")} €`;
const fmtSaldo = (n: number) => `${n < 0 ? "−" : ""}${Math.round(Math.abs(n)).toLocaleString("de-DE")} €`;
const fmtK = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}K` : String(Math.round(n)));
const fmtDate = (d: string) => d.split("-").reverse().join("/");

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
const GREEN = "#1E8C5A";
const RED = "#c2532a";
const GREEN_TXT = "text-[#0d8037] dark:text-[#78e39f]";
const RED_TXT = "text-[#b53e0d] dark:text-[#e69675]";
const SEL_BG = "bg-[#faf6ee] dark:bg-[#2a2620]";

// ── Reagrupación mes → período seleccionado ───────────────────────────────────

type Period = { key: string; label: string };
type RolledRow = { key: string; label: string; color: string; group?: EconomicGroup; byPeriod: Record<string, number>; total: number };
type ExpenseGroup = { group: EconomicGroup; rows: RolledRow[]; totalByPeriod: Record<string, number>; grand: number };
type Rolled = {
  periods: Period[];
  currentPeriod: string;
  incomeRows: RolledRow[];
  expenseGroups: ExpenseGroup[];
  incomeTotal: Record<string, number>;
  expenseTotal: Record<string, number>;
  resultado: Record<string, number>;
  saldoInicial: Record<string, number>;
  saldoFinal: Record<string, number>;
  grandIncome: number;
  grandExpense: number;
};

function rollup(data: StatementData, g: Granularity): Rolled {
  const seen = new Set<string>();
  const periods: Period[] = [];
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
    const rows = expenseRowsAll.filter((row) => row.group === group).sort((a, b) => b.total - a.total);
    if (rows.length === 0) continue;
    const totalByPeriod: Record<string, number> = {};
    for (const { key: p } of periods) totalByPeriod[p] = rows.reduce((s, row) => s + (row.byPeriod[p] ?? 0), 0);
    expenseGroups.push({ group, rows, totalByPeriod, grand: rows.reduce((s, row) => s + row.total, 0) });
  }

  const incomeTotal: Record<string, number> = {};
  const expenseTotal: Record<string, number> = {};
  const resultado: Record<string, number> = {};
  const saldoInicial: Record<string, number> = {};
  const saldoFinal: Record<string, number> = {};

  for (const { key: p } of periods) {
    incomeTotal[p] = incomeRows.reduce((s, row) => s + (row.byPeriod[p] ?? 0), 0);
    expenseTotal[p] = expenseGroups.reduce((s, gr) => s + (gr.totalByPeriod[p] ?? 0), 0);
    resultado[p] = incomeTotal[p] - expenseTotal[p];
  }

  // Saldo real del banco (campo balance), no encadenado por importes: el cierre de cada
  // período es el saldo del último mes que lo compone. Así el "Saldo final" cuadra con el banco
  // aunque haya efectivo (que se muestra en Entradas/Salidas pero no toca el saldo bancario).
  const periodLastMonth: Record<string, string> = {};
  for (const m of data.months) periodLastMonth[periodKeyOf(m, g)] = m; // meses asc → último del período gana
  let prevFinal = data.openingBalance;
  for (const { key: p } of periods) {
    saldoInicial[p] = prevFinal;
    saldoFinal[p] = data.saldoFinalByMonth[periodLastMonth[p]] ?? prevFinal;
    prevFinal = saldoFinal[p];
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
    grandIncome: Object.values(incomeTotal).reduce((s, v) => s + v, 0),
    grandExpense: Object.values(expenseTotal).reduce((s, v) => s + v, 0),
  };
}

// ── Clases de celda ───────────────────────────────────────────────────────────

const LABEL_CELL = "sticky left-0 z-10 pr-3 text-left w-[190px] min-w-[190px] sm:w-[232px] sm:min-w-[232px]";
const NUM_CELL = "px-3 py-[9px] text-right tabular-nums whitespace-nowrap w-[104px] min-w-[104px]";
const TOTAL_CELL = "px-3 py-[9px] text-right tabular-nums whitespace-nowrap w-[116px] min-w-[116px] border-l border-border bg-subtle/60";

type DrawerState = { title: string; subtitle: string; txns: StatementTxn[] } | null;

// ── Componente ────────────────────────────────────────────────────────────────

export default function PrevisionesHistorico({ statement }: { statement: StatementData }) {
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [showIncome, setShowIncome] = useState(true);
  const [showExpense, setShowExpense] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<EconomicGroup>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const r = useMemo(() => rollup(statement, granularity), [statement, granularity]);
  const hasData = r.periods.length > 0;

  // Período resaltado / de las tarjetas KPI: el elegido si sigue existiendo, si no el actual, si no el último.
  const selected =
    (selectedKey && r.periods.some((p) => p.key === selectedKey) && selectedKey) ||
    (r.periods.some((p) => p.key === r.currentPeriod) && r.currentPeriod) ||
    (hasData ? r.periods[r.periods.length - 1].key : "");

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
  const selectedLabel = r.periods.find((p) => p.key === selected)?.label ?? "";

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <p className="text-[13px] text-muted max-w-[440px]">
          Ingresos y gastos según el banco, con todo incluido para que el saldo cuadre. Toca una celda para ver sus transacciones.
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
        <div className="bg-card border border-border rounded-[14px] py-16 text-center text-faint text-sm">Sin movimientos que mostrar.</div>
      ) : (
        <>
          {/* KPIs (período seleccionado) + gráfica */}
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 mb-4">
            <div className="lg:w-[210px] shrink-0">
              <p className="text-[15px] font-bold text-navy mb-2 capitalize">{selectedLabel}</p>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                <KpiCard icon="saldo" label="Saldo inicial" value={fmtSaldo(r.saldoInicial[selected])} />
                <KpiCard icon="in" label="Entradas" value={fmtEur(r.incomeTotal[selected])} valueClass={GREEN_TXT} />
                <KpiCard icon="out" label="Salidas" value={`−${fmtEur(r.expenseTotal[selected])}`} valueClass={RED_TXT} />
                <KpiCard icon="saldo" label="Saldo final" value={fmtSaldo(r.saldoFinal[selected])} strong />
              </div>
            </div>
            <div className="flex-1 min-w-0 bg-card border border-border rounded-[14px] px-3 sm:px-4 pt-3 pb-2">
              <CashflowChart r={r} selected={selected} onSelect={setSelectedKey} />
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-card border border-border rounded-[14px] overflow-hidden">
            <div ref={scrollRef} className="overflow-x-auto">
              <table className="border-collapse text-[12px]" style={{ minWidth: `${232 + r.periods.length * 104 + 116}px` }}>
                <thead>
                  <tr className="border-b border-border">
                    <th className={`${LABEL_CELL} pl-3 sm:pl-4 py-2 bg-card`} />
                    {r.periods.map((p) => {
                      const isSel = p.key === selected;
                      return (
                        <th
                          key={p.key}
                          onClick={() => setSelectedKey(p.key)}
                          className={`${NUM_CELL} cursor-pointer align-bottom ${isSel ? SEL_BG : ""}`}
                        >
                          {p.key === r.currentPeriod && (
                            <span className="block text-[8.5px] font-bold tracking-wider text-[#b58a3a] dark:text-[#e0ab5c] mb-0.5">ACTUAL</span>
                          )}
                          <span className={`text-[10.5px] font-semibold uppercase tracking-wide ${isSel ? "text-navy" : "text-faint"}`}>{p.label}</span>
                        </th>
                      );
                    })}
                    <th className={`${TOTAL_CELL} py-2 text-[10.5px] font-semibold uppercase tracking-wide text-strong align-bottom`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <SummaryRow
                    label="Saldo inicial" icon="saldo" periods={r.periods} selected={selected}
                    valueFor={(p) => r.saldoInicial[p]} totalValue={r.saldoInicial[r.periods[0].key]}
                    format={fmtSaldo} colorFor={(v) => (v < 0 ? RED_TXT : "text-muted")} tone="muted"
                  />

                  <SectionRow
                    label="Entradas" icon="in" open={showIncome} onToggle={() => setShowIncome((v) => !v)}
                    periods={r.periods} selected={selected}
                    totalByPeriod={r.incomeTotal} grand={r.grandIncome} colorClass={GREEN_TXT} sign="+"
                    onCell={(p) => openTxns("Entradas", incomeKeys, p)}
                  />
                  {showIncome &&
                    r.incomeRows.map((row) => (
                      <LeafRow key={row.key} row={row} periods={r.periods} selected={selected}
                        indent="pl-8 sm:pl-9" onCell={(p) => openTxns(row.label, [row.key], p)} />
                    ))}

                  <SectionRow
                    label="Salidas" icon="out" open={showExpense} onToggle={() => setShowExpense((v) => !v)}
                    periods={r.periods} selected={selected}
                    totalByPeriod={r.expenseTotal} grand={r.grandExpense} colorClass={RED_TXT} sign="−"
                    onCell={(p) => openTxns("Salidas", allExpenseKeys, p)}
                  />
                  {showExpense &&
                    r.expenseGroups.map((gr) => {
                      const open = expandedGroups.has(gr.group);
                      const groupKeys = gr.rows.map((row) => row.key);
                      return (
                        <GroupFragment key={gr.group}>
                          <GroupRow group={gr} open={open} onToggle={() => toggleGroup(gr.group)}
                            periods={r.periods} selected={selected}
                            onCell={(p) => openTxns(GROUP_LABELS[gr.group], groupKeys, p)} />
                          {open &&
                            gr.rows.map((row) => (
                              <LeafRow key={row.key} row={row} periods={r.periods} selected={selected}
                                indent="pl-[52px] sm:pl-[60px]" onCell={(p) => openTxns(row.label, [row.key], p)} />
                            ))}
                        </GroupFragment>
                      );
                    })}

                  <SummaryRow
                    label="Resultado" periods={r.periods} selected={selected}
                    valueFor={(p) => r.resultado[p]} totalValue={r.grandIncome - r.grandExpense}
                    format={fmtSigned} colorFor={(v) => (v >= 0 ? GREEN_TXT : RED_TXT)} tone="strong" topBorder
                  />
                  <SummaryRow
                    label="Saldo final" icon="saldo" periods={r.periods} selected={selected}
                    valueFor={(p) => r.saldoFinal[p]} totalValue={r.saldoFinal[r.periods[r.periods.length - 1].key]}
                    format={fmtSaldo} colorFor={(v) => (v < 0 ? RED_TXT : "text-navy")} tone="bold"
                  />
                </tbody>
              </table>
            </div>
          </div>
        </>
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
                <p className={`text-sm font-semibold tabular-nums shrink-0 ${t.amount < 0 ? "text-navy" : GREEN_TXT}`}>
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

// ── Gráfica combinada (barras entradas/salidas + línea de saldo) ───────────────

function CashflowChart({ r, selected, onSelect }: { r: Rolled; selected: string; onSelect: (k: string) => void }) {
  const H = 168;
  const maxBar = Math.max(1, ...r.periods.map((p) => Math.max(r.incomeTotal[p.key] ?? 0, r.expenseTotal[p.key] ?? 0)));
  const saldos = r.periods.map((p) => r.saldoFinal[p.key] ?? 0);
  const minS = Math.min(0, ...saldos);
  const maxS = Math.max(1, ...saldos);
  const rangeS = maxS - minS || 1;
  const saldoY = (v: number) => 88 - ((v - minS) / rangeS) * 76;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxBar);
  const n = r.periods.length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 text-[10.5px] text-faint">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: GREEN }} /> Entradas</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: RED }} /> Salidas</span>
        <span className="flex items-center gap-1"><span className="w-4 h-[2px] rounded-full bg-navy/60" /> Saldo</span>
      </div>
      <div className="flex">
        {/* Eje Y */}
        <div className="relative w-8 shrink-0" style={{ height: H }}>
          {ticks.map((t, i) => (
            <span key={i} className="absolute right-1 -translate-y-1/2 text-[9px] text-faint tabular-nums" style={{ top: `${(1 - t / maxBar) * 100}%` }}>
              {fmtK(t)}
            </span>
          ))}
        </div>
        {/* Área */}
        <div className="relative flex-1 min-w-0" style={{ height: H }}>
          {ticks.map((t, i) => (
            <div key={i} className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: `${(1 - t / maxBar) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex">
            {r.periods.map((p) => {
              const inH = ((r.incomeTotal[p.key] ?? 0) / maxBar) * 100;
              const outH = ((r.expenseTotal[p.key] ?? 0) / maxBar) * 100;
              const isSel = p.key === selected;
              const isCur = p.key === r.currentPeriod;
              return (
                <button
                  type="button"
                  key={p.key}
                  onClick={() => onSelect(p.key)}
                  className={`relative flex-1 min-w-0 flex items-end justify-center gap-[3px] ${isSel ? SEL_BG : ""}`}
                  title={p.label}
                >
                  <span className="w-[26%] max-w-[16px] rounded-t-[2px]" style={{ height: `${inH}%`, background: GREEN, opacity: isCur ? 0.55 : 1 }} />
                  <span className="w-[26%] max-w-[16px] rounded-t-[2px]" style={{ height: `${outH}%`, background: RED, opacity: isCur ? 0.55 : 1 }} />
                </button>
              );
            })}
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
            <polyline
              points={r.periods.map((p, i) => `${((i + 0.5) / n) * 100},${saldoY(r.saldoFinal[p.key] ?? 0)}`).join(" ")}
              fill="none" stroke="var(--color-navy)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke" opacity="0.7"
            />
            {r.periods.map((p, i) => (
              <circle key={p.key} cx={((i + 0.5) / n) * 100} cy={saldoY(r.saldoFinal[p.key] ?? 0)} r="1.8"
                fill="var(--color-navy)" vectorEffect="non-scaling-stroke" opacity={p.key === selected ? 1 : 0.7} />
            ))}
          </svg>
        </div>
      </div>
      {/* Etiquetas X */}
      <div className="flex pl-8">
        {r.periods.map((p) => (
          <div key={p.key} className={`flex-1 min-w-0 text-center truncate text-[9.5px] pt-1 ${p.key === selected ? "text-navy font-semibold" : "text-faint"}`}>
            {p.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tarjeta KPI ────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, valueClass }: { icon: KpiIcon; label: string; value: string; valueClass?: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 bg-card border border-border rounded-[12px] px-3 py-2.5">
      <span className="shrink-0 w-8 h-8 rounded-[9px] bg-subtle flex items-center justify-center text-muted"><Icon name={icon} /></span>
      <div className="min-w-0">
        <p className="text-[10.5px] text-faint font-medium truncate">{label}</p>
        <p className={`text-[14px] font-bold tabular-nums truncate ${valueClass ?? "text-navy"}`}>{value}</p>
      </div>
    </div>
  );
}

type KpiIcon = "saldo" | "in" | "out";
function Icon({ name }: { name: KpiIcon }) {
  if (name === "in")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
      </svg>
    );
  if (name === "out")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="7" x2="17" y2="17" /><polyline points="17 7 17 17 7 17" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="14" x2="20" y2="14" />
    </svg>
  );
}

// ── Celdas numéricas ────────────────────────────────────────────────────────────

function NumCells({
  periods, selected, valueFor, totalValue, format, valClass, onCell,
}: {
  periods: Period[];
  selected: string;
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
        <td key={p.key} onClick={onCell ? () => onCell(p.key) : undefined}
          className={`${NUM_CELL} ${valClass} ${clickable} ${p.key === selected ? SEL_BG : ""}`}>
          {format(valueFor(p.key))}
        </td>
      ))}
      <td onClick={onCell ? () => onCell(null) : undefined} className={`${TOTAL_CELL} ${valClass} ${clickable}`}>
        {format(totalValue)}
      </td>
    </>
  );
}

// ── Fila resumen (Saldo, Resultado) ─────────────────────────────────────────────

function SummaryRow({
  label, icon, periods, selected, valueFor, totalValue, format, colorFor, tone, topBorder,
}: {
  label: string;
  icon?: KpiIcon;
  periods: Period[];
  selected: string;
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
      <td className={`${LABEL_CELL} pl-3 sm:pl-4 py-[9px] ${rowBg} text-[12px]`}>
        <span className="flex items-center gap-1.5">
          {icon && <span className="text-faint"><Icon name={icon} /></span>}
          <span className={labelWeight}>{label}</span>
        </span>
      </td>
      {periods.map((p) => {
        const v = valueFor(p.key);
        return (
          <td key={p.key} className={`${NUM_CELL} ${valWeight} ${colorFor(v)} ${p.key === selected ? SEL_BG : ""}`}>
            {format(v)}
          </td>
        );
      })}
      <td className={`${TOTAL_CELL} ${valWeight} ${colorFor(totalValue)}`}>{format(totalValue)}</td>
    </tr>
  );
}

// ── Fila de sección (Entradas / Salidas) ────────────────────────────────────────

function SectionRow({
  label, icon, open, onToggle, periods, selected, totalByPeriod, grand, colorClass, sign, onCell,
}: {
  label: string;
  icon: KpiIcon;
  open: boolean;
  onToggle: () => void;
  periods: Period[];
  selected: string;
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
          <span className={colorClass}><Icon name={icon} /></span>
          <span className="text-[11.5px] font-bold uppercase tracking-wide text-navy">{label}</span>
        </button>
      </td>
      <NumCells
        periods={periods} selected={selected}
        valueFor={(p) => totalByPeriod[p] ?? 0} totalValue={grand}
        format={(v) => (v > 0 ? `${sign}${fmtEur(v)}` : "-")}
        valClass={`font-bold ${colorClass}`} onCell={onCell}
      />
    </tr>
  );
}

// ── Fila de grupo madre ─────────────────────────────────────────────────────────

function GroupRow({
  group, open, onToggle, periods, selected, onCell,
}: {
  group: ExpenseGroup;
  open: boolean;
  onToggle: () => void;
  periods: Period[];
  selected: string;
  onCell: (period: string | null) => void;
}) {
  return (
    <tr className="border-t border-subtle hover:bg-subtle/40">
      <td className={`${LABEL_CELL} pl-6 sm:pl-7 py-[8px] bg-card`}>
        <button type="button" onClick={onToggle} className="flex items-center gap-1.5 min-w-0">
          <Chevron open={open} small />
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: GROUP_COLORS[group.group] }} />
          <span className="text-[12.5px] font-semibold text-navy truncate">{GROUP_LABELS[group.group]}</span>
        </button>
      </td>
      <NumCells
        periods={periods} selected={selected}
        valueFor={(p) => group.totalByPeriod[p] ?? 0} totalValue={group.grand}
        format={(v) => (v > 0 ? fmtEur(v) : "-")} valClass="font-semibold text-navy" onCell={onCell}
      />
    </tr>
  );
}

// ── Fila hoja (categoría) ────────────────────────────────────────────────────────

function LeafRow({
  row, periods, selected, indent, onCell,
}: {
  row: RolledRow;
  periods: Period[];
  selected: string;
  indent: string;
  onCell: (period: string | null) => void;
}) {
  return (
    <tr className="border-t border-subtle hover:bg-subtle/40">
      <td className={`${LABEL_CELL} ${indent} py-[8px] bg-card`}>
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: row.color }} />
          <span className="text-[12.5px] text-muted truncate">{row.label}</span>
        </span>
      </td>
      <NumCells
        periods={periods} selected={selected}
        valueFor={(p) => row.byPeriod[p] ?? 0} totalValue={row.total}
        format={(v) => (v > 0 ? fmtEur(v) : "-")} valClass="text-navy/80" onCell={onCell}
      />
    </tr>
  );
}

function GroupFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Chevron({ open, small }: { open: boolean; small?: boolean }) {
  const s = small ? 11 : 12;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" className={`text-faint transition-transform ${open ? "" : "-rotate-90"}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
