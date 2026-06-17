"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import {
  buildForecast,
  CAPACITY_SCENARIOS,
  type RecurringExpense,
  type ForecastParams,
  type MonthlyActual,
  type MonthlyForecast,
  type CapacityScenario,
  type HistoricalByCategory,
} from "@/lib/previsiones";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtSign(n: number) {
  return (n >= 0 ? "+" : "−") + fmt(Math.abs(n)) + " €";
}
function fmtAmt(n: number) {
  return fmt(Math.abs(n)) + " €";
}

const TODAY_MONTH = new Date().toISOString().slice(0, 7);

// ── Scenario cards ────────────────────────────────────────────────────────────

function ScenarioCards({
  selected,
  onSelect,
  currentSalaryBase,
}: {
  selected: string;
  onSelect: (id: string) => void;
  currentSalaryBase: number;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
      {CAPACITY_SCENARIOS.map((s) => {
        const isActive = selected === s.id;
        const deltaSalarios = s.salariosMes - currentSalaryBase;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`text-left rounded-xl border p-3 sm:p-4 transition-all ${
              isActive
                ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                : "border-navy/[0.08] bg-white hover:border-navy/20 hover:bg-navy/[0.02]"
            }`}
          >
            <p className={`text-xs font-semibold mb-0.5 ${isActive ? "text-primary" : "text-navy"}`}>
              {s.label}
            </p>
            <p className="text-[10px] text-navy/45 mb-2 leading-tight">{s.sublabel}</p>
            <div className="space-y-0.5">
              <div className="flex justify-between items-baseline gap-1">
                <span className="text-[10px] text-navy/40">Plazas/mes</span>
                <span className="text-xs font-semibold text-navy tabular-nums">{s.plazasMes}</span>
              </div>
              <div className="flex justify-between items-baseline gap-1">
                <span className="text-[10px] text-navy/40">Máx. alumnos</span>
                <span className="text-xs font-semibold text-navy tabular-nums">{s.maxAlumnos}</span>
              </div>
              <div className="flex justify-between items-baseline gap-1">
                <span className="text-[10px] text-navy/40">Break even</span>
                <span className="text-xs tabular-nums text-navy/60">{s.breakEvenAlumnos} al.</span>
              </div>
              <div className="flex justify-between items-baseline gap-1 pt-1 border-t border-navy/[0.06] mt-1">
                <span className="text-[10px] text-navy/40">Salarios</span>
                <span className={`text-xs font-semibold tabular-nums ${
                  deltaSalarios > 0 ? "text-danger" : deltaSalarios < 0 ? "text-income" : "text-navy"
                }`}>
                  {deltaSalarios === 0
                    ? `${fmt(s.salariosMes)} €`
                    : `${deltaSalarios > 0 ? "+" : ""}${fmt(deltaSalarios)} €`}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function CombinedChart({
  historical,
  forecast,
  showForecast,
}: {
  historical: MonthlyActual[];
  forecast: MonthlyForecast[];
  showForecast: boolean;
}) {
  const allMonths = [
    ...historical.map(m => ({ month: m.month, entradas: m.entradas, salidas: m.salidas, saldo: m.saldoFinal, isForecast: false })),
    ...(showForecast ? forecast.map(m => ({ month: m.month, entradas: m.totalEntradas, salidas: m.totalSalidas, saldo: m.saldoFinal, isForecast: true })) : []),
  ];

  if (allMonths.length === 0) return null;

  const H = 100;
  const W = 600;
  const barW = W / allMonths.length;
  const maxVal = Math.max(...allMonths.map(m => Math.max(m.entradas, m.salidas)), 1);
  const allSaldos = allMonths.map(m => m.saldo ?? 0);
  const minSaldo = Math.min(...allSaldos, 0);
  const maxSaldo = Math.max(...allSaldos, 1);
  const saldoRange = maxSaldo - minSaldo || 1;

  const saldoY = (v: number) => H - ((v - minSaldo) / saldoRange) * (H * 0.6) - H * 0.2;
  const pastCount = historical.length;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-20">
        {minSaldo < 0 && (
          <line x1="0" y1={saldoY(0)} x2={W} y2={saldoY(0)}
            stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="3,2" />
        )}
        {allMonths.map((m, i) => {
          const barsH = H * 0.5;
          const inH = Math.min((m.entradas / maxVal) * barsH, barsH);
          const outH = Math.min((m.salidas / maxVal) * barsH, barsH);
          const opacity = m.isForecast ? 0.35 : 0.75;
          const x = i * barW + barW * 0.1;
          const w = barW * 0.38;
          return (
            <g key={m.month}>
              {m.month === TODAY_MONTH && (
                <line x1={i * barW} y1={0} x2={i * barW} y2={H}
                  stroke="#4021c8" strokeWidth="0.5" strokeDasharray="2,2" opacity={0.4} />
              )}
              <rect x={x} y={H - inH} width={w} height={inH} fill="#298a83" opacity={opacity} rx="0.5" />
              <rect x={x + w + barW * 0.04} y={H - outH} width={w} height={outH} fill="#e53935" opacity={opacity} rx="0.5" />
            </g>
          );
        })}
        {historical.length > 0 && (
          <polyline
            points={allMonths.slice(0, pastCount).map((m, i) => `${(i + 0.5) * barW},${saldoY(m.saldo ?? 0)}`).join(" ")}
            fill="none" stroke="#4021c8" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          />
        )}
        {showForecast && forecast.length > 0 && (
          <polyline
            points={[
              ...(historical.length > 0
                ? [`${(pastCount - 0.5) * barW},${saldoY(historical[historical.length - 1].saldoFinal ?? 0)}`]
                : []),
              ...forecast.map((m, i) => `${(pastCount + i + 0.5) * barW},${saldoY(m.saldoFinal)}`),
            ].join(" ")}
            fill="none" stroke="#4021c8" strokeWidth="1.5" strokeDasharray="4,3"
            strokeLinecap="round" strokeLinejoin="round" opacity={0.55} vectorEffect="non-scaling-stroke"
          />
        )}
        {allMonths.map((m, i) => (
          <circle key={m.month} cx={(i + 0.5) * barW} cy={saldoY(m.saldo ?? 0)} r="1.5"
            fill="#4021c8" opacity={m.isForecast ? 0.4 : 0.9} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="flex mt-0.5">
        {allMonths.map((m, i) => (
          <div key={m.month} className="flex-1 text-center">
            {(i % Math.ceil(allMonths.length / 8) === 0 || i === allMonths.length - 1) && (
              <span className={`text-[9px] ${m.isForecast ? "text-navy/25" : "text-navy/40"}`}>
                {m.month.slice(2, 4)}/{m.month.slice(5, 7)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Inline number input (params bar) ─────────────────────────────────────────

function InlineParam({
  label,
  value,
  onChange,
  suffix,
  step = 1,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  step?: number;
  min?: number;
}) {
  return (
    <label className="flex items-center gap-2 px-3 py-2 bg-white border border-navy/[0.08] rounded-lg cursor-text hover:border-navy/20 transition-colors">
      <span className="text-[11px] text-navy/45 whitespace-nowrap">{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        step={step}
        min={min}
        className="w-14 bg-transparent text-xs font-semibold text-navy text-right outline-none tabular-nums"
      />
      <span className="text-[11px] text-navy/40 whitespace-nowrap">{suffix}</span>
    </label>
  );
}

// ── Editable forecast cell ────────────────────────────────────────────────────

function EditableCell({
  value,
  cellKey,
  isEditing,
  editValue,
  onStartEdit,
  onChangeEdit,
  onCommit,
  isOverridden,
  colorClass,
  prefix,
}: {
  value: number;
  cellKey: string;
  isEditing: boolean;
  editValue: string;
  onStartEdit: (key: string, val: string) => void;
  onChangeEdit: (val: string) => void;
  onCommit: (key: string, val: string) => void;
  isOverridden: boolean;
  colorClass: string;
  prefix?: string;
}) {
  if (isEditing) {
    return (
      <td className="px-1 py-1.5 text-right w-[88px] min-w-[88px]">
        <input
          autoFocus
          type="number"
          value={editValue}
          onChange={e => onChangeEdit(e.target.value)}
          onBlur={() => onCommit(cellKey, editValue)}
          onKeyDown={e => {
            if (e.key === "Enter") onCommit(cellKey, editValue);
            if (e.key === "Escape") onCommit(cellKey, String(value));
          }}
          className="w-full text-right text-xs font-semibold tabular-nums bg-primary/[0.06] border border-primary/30 rounded px-1.5 py-0.5 outline-none text-primary"
        />
      </td>
    );
  }
  return (
    <td
      onClick={() => onStartEdit(cellKey, String(Math.round(value)))}
      title="Haz clic para editar"
      className={`px-3 py-2.5 text-right text-xs tabular-nums whitespace-nowrap cursor-pointer opacity-55 italic hover:opacity-80 hover:bg-primary/[0.03] transition-all group w-[88px] min-w-[88px] ${colorClass}`}
    >
      <span className={isOverridden ? "underline decoration-dotted" : ""}>
        {prefix}{fmtAmt(value)}
      </span>
      {isOverridden && (
        <span className="ml-0.5 inline-block w-1 h-1 rounded-full bg-primary/50 align-middle" />
      )}
    </td>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PrevisionesTable({
  baseMrr,
  packsBase,
  startingBalance,
  recurringExpenses,
  historical,
  historicalByCat,
}: {
  baseMrr: number;
  packsBase: number;
  startingBalance: number;
  recurringExpenses: RecurringExpense[];
  historical: MonthlyActual[];
  historicalByCat: HistoricalByCategory;
}) {
  const [showForecast, setShowForecast] = useState(true);
  const [scenarioId, setScenarioId] = useState("actual");
  const [params, setParams] = useState<ForecastParams>({
    mrrBase:           Math.round(baseMrr),
    packsBase:         Math.round(packsBase),
    crecimientoPct:    0,
    retencionesPct:    0,
    prestamo:          0,
    salarioAumentoPct: 0,
  });

  // cellOverrides: rowKey → month → overridden value
  const [cellOverrides, setCellOverrides] = useState<Record<string, Record<string, number>>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function set<K extends keyof ForecastParams>(key: K, val: ForecastParams[K]) {
    setParams(p => ({ ...p, [key]: val }));
  }

  const selectedScenario: CapacityScenario =
    CAPACITY_SCENARIOS.find(s => s.id === scenarioId) ?? CAPACITY_SCENARIOS[0];
  const salaryBase = recurringExpenses.find(e => e.category === "Salarios")?.avgMonthly ?? 2660;

  const forecast = useMemo(() =>
    buildForecast(
      startingBalance,
      recurringExpenses,
      params,
      scenarioId !== "actual" ? selectedScenario.salariosMes : undefined,
      12,
      cellOverrides,
    ),
    [startingBalance, recurringExpenses, params, scenarioId, selectedScenario, cellOverrides],
  );

  const startEdit = useCallback((key: string, val: string) => {
    setEditingCell(key);
    setEditValue(val);
  }, []);

  const commitEdit = useCallback((key: string, rawVal: string) => {
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num >= 0) {
      const [rowKey, month] = key.split("::");
      setCellOverrides(prev => ({
        ...prev,
        [rowKey]: { ...(prev[rowKey] ?? {}), [month]: Math.round(num) },
      }));
    }
    setEditingCell(null);
    setEditValue("");
  }, []);

  const pastMonths = historical;
  const futureMonths = showForecast ? forecast : [];
  const fcSaldoFinal = forecast[forecast.length - 1]?.saldoFinal ?? startingBalance;

  // Check if a cell has an override
  function isOverridden(rowKey: string, month: string) {
    return cellOverrides[rowKey]?.[month] !== undefined;
  }

  const hasOverrides = Object.keys(cellOverrides).length > 0;

  return (
    <div className="space-y-4">

      {/* ── Scenario selector ── */}
      <div>
        <p className="text-xs font-semibold text-navy/45 uppercase tracking-wider mb-3">
          Escenario de capacidad
        </p>
        <ScenarioCards selected={scenarioId} onSelect={setScenarioId} currentSalaryBase={salaryBase} />
      </div>

      {/* ── Params bar + toggle ── */}
      <div className="flex flex-wrap items-center gap-2">
        <InlineParam label="Crecimiento" value={params.crecimientoPct} onChange={v => set("crecimientoPct", v)} suffix="% /mes" step={0.5} />
        <InlineParam label="Retenciones" value={params.retencionesPct} onChange={v => set("retencionesPct", v)} suffix="%" step={1} />
        <InlineParam label="Préstamo" value={params.prestamo} onChange={v => set("prestamo", v)} suffix="€/mes" step={50} />

        <div className="ml-auto flex items-center gap-2">
          {hasOverrides && (
            <button
              onClick={() => setCellOverrides({})}
              className="text-[11px] text-navy/40 hover:text-danger transition-colors px-2 py-1.5 rounded"
            >
              Limpiar ajustes
            </button>
          )}
          <button
            onClick={() => setShowForecast(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
              showForecast
                ? "bg-primary/[0.08] border-primary/20 text-primary"
                : "bg-navy/[0.04] border-navy/10 text-navy/45 hover:text-navy"
            }`}
          >
            <span className={`w-2 h-2 rounded-full border ${showForecast ? "bg-primary border-primary" : "bg-transparent border-navy/30"}`} />
            Previsiones {showForecast ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-navy/55 uppercase tracking-wider">Evolución</p>
          <div className="flex items-center gap-3 text-[10px] text-navy/40">
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-income/70 rounded-sm inline-block" /> Entradas</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-danger/70 rounded-sm inline-block" /> Salidas</span>
            <span className="flex items-center gap-1"><span className="w-5 border-t border-primary border-solid inline-block" /> Saldo</span>
          </div>
        </div>
        <CombinedChart historical={historical} forecast={forecast} showForecast={showForecast} />
      </div>

      {/* ── KPI strip ── */}
      {showForecast && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-navy/[0.07] rounded-xl p-3">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-0.5">Entradas 12m</p>
            <p className="text-base font-semibold text-income tabular-nums">
              {fmtAmt(forecast.reduce((s, m) => s + m.totalEntradas, 0))}
            </p>
          </div>
          <div className="bg-white border border-navy/[0.07] rounded-xl p-3">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-0.5">Salidas 12m</p>
            <p className="text-base font-semibold text-danger tabular-nums">
              {fmtAmt(forecast.reduce((s, m) => s + m.totalSalidas, 0))}
            </p>
          </div>
          <div className="bg-white border border-navy/[0.07] rounded-xl p-3">
            <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-0.5">Saldo final</p>
            <p className={`text-base font-semibold tabular-nums ${fcSaldoFinal >= 0 ? "text-navy" : "text-danger"}`}>
              {fmtSign(fcSaldoFinal)}
            </p>
          </div>
        </div>
      )}

      {/* ── Main budget table ── */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="border-collapse text-xs"
            style={{ minWidth: `${(pastMonths.length + futureMonths.length) * 88 + 160}px` }}
          >
            <thead>
              <tr className="border-b border-navy/[0.07] bg-navy/[0.015]">
                <th className="sticky left-0 z-10 bg-navy/[0.015] px-4 py-2.5 text-left font-semibold text-navy/40 uppercase tracking-wider w-[160px] min-w-[160px] text-[10px]" />
                {pastMonths.map(m => (
                  <th key={m.month}
                    className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap w-[88px] min-w-[88px] text-[10px] ${
                      m.month === TODAY_MONTH ? "text-primary" : "text-navy/40"
                    }`}
                  >
                    {m.label}
                  </th>
                ))}
                {showForecast && futureMonths.map((m, i) => (
                  <th key={m.month}
                    className={`px-3 py-2.5 text-right font-medium whitespace-nowrap text-navy/25 w-[88px] min-w-[88px] text-[10px] ${
                      i === 0 ? "border-l border-dashed border-primary/20" : ""
                    }`}
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>

              {/* ══ INGRESOS section ══ */}
              <SectionHeader
                label="INGRESOS"
                pastMonths={pastMonths}
                futureMonths={futureMonths}
                showForecast={showForecast}
                getHistVal={m => m.entradas}
                getFcVal={m => m.totalEntradas}
                colorClass="text-income"
                signPrefix="+"
              />

              {/* MRR sub-row */}
              <SubRow
                label="MRR / Suscripciones"
                rowKey="mrr"
                pastMonths={pastMonths}
                futureMonths={futureMonths}
                showForecast={showForecast}
                getHistVal={() => null}
                getFcVal={m => m.mrr}
                colorClass="text-income/70"
                editingCell={editingCell}
                editValue={editValue}
                onStartEdit={startEdit}
                onChangeEdit={setEditValue}
                onCommit={commitEdit}
                isOverridden={isOverridden}
                prefix="+"
              />

              {/* Packs sub-row */}
              <SubRow
                label="Packs y clases"
                rowKey="packs"
                pastMonths={pastMonths}
                futureMonths={futureMonths}
                showForecast={showForecast}
                getHistVal={() => null}
                getFcVal={m => m.packs}
                colorClass="text-income/70"
                editingCell={editingCell}
                editValue={editValue}
                onStartEdit={startEdit}
                onChangeEdit={setEditValue}
                onCommit={commitEdit}
                isOverridden={isOverridden}
                prefix="+"
              />

              {/* ══ GASTOS section ══ */}
              <SectionHeader
                label="GASTOS"
                pastMonths={pastMonths}
                futureMonths={futureMonths}
                showForecast={showForecast}
                getHistVal={m => m.salidas}
                getFcVal={m => m.totalSalidas}
                colorClass="text-danger"
                signPrefix="−"
              />

              {/* One row per recurring expense */}
              {recurringExpenses.map(exp => (
                <SubRow
                  key={exp.category}
                  label={exp.category}
                  rowKey={exp.category}
                  pastMonths={pastMonths}
                  futureMonths={futureMonths}
                  showForecast={showForecast}
                  getHistVal={m => historicalByCat[exp.category]?.[m.month] ?? null}
                  getFcVal={m => m.expenses.find(e => e.category === exp.category)?.amount ?? 0}
                  colorClass="text-danger/70"
                  editingCell={editingCell}
                  editValue={editValue}
                  onStartEdit={startEdit}
                  onChangeEdit={setEditValue}
                  onCommit={commitEdit}
                  isOverridden={isOverridden}
                  prefix="−"
                />
              ))}

              {/* Préstamo row (only if non-zero) */}
              {params.prestamo > 0 && (
                <SubRow
                  label="Préstamo"
                  rowKey="__prestamo"
                  pastMonths={pastMonths}
                  futureMonths={futureMonths}
                  showForecast={showForecast}
                  getHistVal={() => null}
                  getFcVal={m => m.prestamo}
                  colorClass="text-danger/70"
                  editingCell={null}
                  editValue=""
                  onStartEdit={() => {}}
                  onChangeEdit={() => {}}
                  onCommit={() => {}}
                  isOverridden={() => false}
                  prefix="−"
                  readonly
                />
              )}

              {/* ══ Separator row ══ */}
              <tr><td colSpan={999} className="h-px bg-navy/[0.07]" /></tr>

              {/* RESULTADO */}
              <SummaryRow
                label="Resultado"
                pastMonths={pastMonths}
                futureMonths={futureMonths}
                showForecast={showForecast}
                getHistVal={m => m.resultado}
                getFcVal={m => m.resultado}
                format={v => v !== null ? fmtSign(v) : "—"}
                colorFn={v => v === null ? "text-navy/30" : v >= 0 ? "text-income font-semibold" : "text-danger font-semibold"}
              />

              {/* SALDO FINAL */}
              <SummaryRow
                label="Saldo final"
                pastMonths={pastMonths}
                futureMonths={futureMonths}
                showForecast={showForecast}
                getHistVal={m => m.saldoFinal}
                getFcVal={m => m.saldoFinal}
                format={v => v !== null ? fmtSign(v) : "—"}
                colorFn={v => v === null ? "text-navy/30" : v >= 0 ? "text-navy font-bold" : "text-danger font-bold"}
              />

            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-navy/30 px-5 py-2.5 border-t border-navy/[0.04] italic">
          Columnas en cursiva = previsión · Haz clic en cualquier celda de previsión para editarla · Punto azul = valor modificado
        </p>
      </div>
    </div>
  );
}

// ── Sub-components for table rows ─────────────────────────────────────────────

function SectionHeader({
  label,
  pastMonths,
  futureMonths,
  showForecast,
  getHistVal,
  getFcVal,
  colorClass,
  signPrefix,
}: {
  label: string;
  pastMonths: MonthlyActual[];
  futureMonths: MonthlyForecast[];
  showForecast: boolean;
  getHistVal: (m: MonthlyActual) => number;
  getFcVal: (m: MonthlyForecast) => number;
  colorClass: string;
  signPrefix: "+" | "−";
}) {
  return (
    <tr className="border-t-2 border-navy/[0.08] bg-navy/[0.015]">
      <td className="sticky left-0 z-10 bg-navy/[0.015] px-4 py-2 text-[11px] font-bold text-navy uppercase tracking-wider w-[160px] min-w-[160px]">
        {label}
      </td>
      {pastMonths.map(m => (
        <td key={m.month}
          className={`px-3 py-2 text-right text-[11px] font-bold tabular-nums whitespace-nowrap ${colorClass} ${
            m.month === TODAY_MONTH ? "bg-primary/[0.02]" : ""
          }`}
        >
          {signPrefix}{fmtAmt(getHistVal(m))}
        </td>
      ))}
      {showForecast && futureMonths.map((m, i) => (
        <td key={m.month}
          className={`px-3 py-2 text-right text-[11px] font-bold tabular-nums whitespace-nowrap opacity-50 italic ${colorClass} ${
            i === 0 ? "border-l border-dashed border-primary/20" : ""
          }`}
        >
          {signPrefix}{fmtAmt(getFcVal(m))}
        </td>
      ))}
    </tr>
  );
}

function SubRow({
  label,
  rowKey,
  pastMonths,
  futureMonths,
  showForecast,
  getHistVal,
  getFcVal,
  colorClass,
  editingCell,
  editValue,
  onStartEdit,
  onChangeEdit,
  onCommit,
  isOverridden,
  prefix,
  readonly,
}: {
  label: string;
  rowKey: string;
  pastMonths: MonthlyActual[];
  futureMonths: MonthlyForecast[];
  showForecast: boolean;
  getHistVal: (m: MonthlyActual) => number | null;
  getFcVal: (m: MonthlyForecast) => number;
  colorClass: string;
  editingCell: string | null;
  editValue: string;
  onStartEdit: (key: string, val: string) => void;
  onChangeEdit: (val: string) => void;
  onCommit: (key: string, val: string) => void;
  isOverridden: (rowKey: string, month: string) => boolean;
  prefix: "+" | "−";
  readonly?: boolean;
}) {
  return (
    <tr className="hover:bg-navy/[0.01]">
      <td className="sticky left-0 z-10 bg-white px-4 py-2 text-[11px] text-navy/55 pl-6 whitespace-nowrap w-[160px] min-w-[160px]">
        <span className="text-navy/25 mr-1">└</span>{label}
      </td>
      {/* Historical: show actual per-category data or dash */}
      {pastMonths.map(m => {
        const val = getHistVal(m);
        return (
          <td key={m.month}
            className={`px-3 py-2 text-right text-[11px] tabular-nums whitespace-nowrap ${
              val === null ? "text-navy/20" : colorClass
            } ${m.month === TODAY_MONTH ? "bg-primary/[0.02]" : ""}`}
          >
            {val === null ? "—" : `${prefix}${fmtAmt(val)}`}
          </td>
        );
      })}
      {/* Forecast: editable */}
      {showForecast && futureMonths.map((m, i) => {
        const val = getFcVal(m);
        const cellKey = `${rowKey}::${m.month}`;
        const isEdit = editingCell === cellKey;
        const overridden = isOverridden(rowKey, m.month);
        const borderClass = i === 0 ? "border-l border-dashed border-primary/20" : "";

        if (readonly) {
          return (
            <td key={m.month}
              className={`px-3 py-2 text-right text-[11px] tabular-nums whitespace-nowrap opacity-50 italic ${colorClass} ${borderClass}`}
            >
              {prefix}{fmtAmt(val)}
            </td>
          );
        }

        if (isEdit) {
          return (
            <td key={m.month} className={`px-1 py-1 w-[88px] min-w-[88px] ${borderClass}`}>
              <input
                autoFocus
                type="number"
                value={editValue}
                onChange={e => onChangeEdit(e.target.value)}
                onBlur={() => onCommit(cellKey, editValue)}
                onKeyDown={e => {
                  if (e.key === "Enter") onCommit(cellKey, editValue);
                  if (e.key === "Escape") onCommit(cellKey, String(Math.round(val)));
                }}
                className="w-full text-right text-xs font-semibold tabular-nums bg-primary/[0.06] border border-primary/30 rounded px-1.5 py-0.5 outline-none text-primary"
              />
            </td>
          );
        }

        return (
          <td
            key={m.month}
            onClick={() => onStartEdit(cellKey, String(Math.round(val)))}
            title="Clic para editar"
            className={`px-3 py-2 text-right text-[11px] tabular-nums whitespace-nowrap cursor-pointer opacity-50 italic hover:opacity-80 hover:bg-primary/[0.03] transition-all w-[88px] min-w-[88px] ${colorClass} ${borderClass}`}
          >
            {overridden && <span className="mr-0.5 inline-block w-1.5 h-1.5 rounded-full bg-primary/60 align-middle" />}
            {prefix}{fmtAmt(val)}
          </td>
        );
      })}
    </tr>
  );
}

function SummaryRow({
  label,
  pastMonths,
  futureMonths,
  showForecast,
  getHistVal,
  getFcVal,
  format,
  colorFn,
}: {
  label: string;
  pastMonths: MonthlyActual[];
  futureMonths: MonthlyForecast[];
  showForecast: boolean;
  getHistVal: (m: MonthlyActual) => number | null;
  getFcVal: (m: MonthlyForecast) => number;
  format: (v: number | null) => string;
  colorFn: (v: number | null) => string;
}) {
  return (
    <tr className="border-t border-navy/[0.07] bg-navy/[0.01]">
      <td className="sticky left-0 z-10 bg-navy/[0.01] px-4 py-2.5 text-[11px] font-semibold text-navy w-[160px] min-w-[160px]">
        {label}
      </td>
      {pastMonths.map(m => {
        const val = getHistVal(m);
        return (
          <td key={m.month}
            className={`px-3 py-2.5 text-right text-[11px] tabular-nums whitespace-nowrap ${colorFn(val)} ${
              m.month === TODAY_MONTH ? "bg-primary/[0.02]" : ""
            }`}
          >
            {format(val)}
          </td>
        );
      })}
      {showForecast && futureMonths.map((m, i) => {
        const val = getFcVal(m);
        return (
          <td key={m.month}
            className={`px-3 py-2.5 text-right text-[11px] tabular-nums whitespace-nowrap opacity-55 italic ${colorFn(val)} ${
              i === 0 ? "border-l border-dashed border-primary/20" : ""
            }`}
          >
            {format(val)}
          </td>
        );
      })}
    </tr>
  );
}
