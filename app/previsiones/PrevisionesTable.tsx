"use client";

import { useState, useMemo, useRef } from "react";
import {
  buildForecast,
  CAPACITY_SCENARIOS,
  type RecurringExpense,
  type ForecastParams,
  type MonthlyActual,
  type MonthlyForecast,
  type CapacityScenario,
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
                  {deltaSalarios === 0 ? `${fmt(s.salariosMes)} €` : `${deltaSalarios > 0 ? "+" : ""}${fmt(deltaSalarios)} €`}
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
  const zeroSaldoY = saldoY(0);

  const saldoPoints = allMonths
    .map((m, i) => `${(i + 0.5) * barW},${saldoY(m.saldo ?? 0)}`)
    .join(" ");

  const pastCount = historical.length;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-24">
        {/* Zero line for saldo */}
        {minSaldo < 0 && (
          <line x1="0" y1={zeroSaldoY} x2={W} y2={zeroSaldoY}
            stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="3,2" />
        )}

        {/* Bars */}
        {allMonths.map((m, i) => {
          const barsH = H * 0.5;
          const barBase = H;
          const inH = Math.min((m.entradas / maxVal) * barsH, barsH);
          const outH = Math.min((m.salidas / maxVal) * barsH, barsH);
          const opacity = m.isForecast ? 0.35 : 0.75;
          const x = i * barW + barW * 0.1;
          const w = barW * 0.38;
          const isToday = m.month === TODAY_MONTH;
          return (
            <g key={m.month}>
              {isToday && (
                <line x1={i * barW} y1={0} x2={i * barW} y2={H}
                  stroke="#4021c8" strokeWidth="0.5" strokeDasharray="2,2" opacity={0.4} />
              )}
              <rect x={x} y={barBase - inH} width={w} height={inH}
                fill="#298a83" opacity={opacity} rx="0.5" />
              <rect x={x + w + barW * 0.04} y={barBase - outH} width={w} height={outH}
                fill="#e53935" opacity={opacity} rx="0.5" />
            </g>
          );
        })}

        {/* Saldo line — split past/future */}
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
              ...(historical.length > 0 ? [`${(pastCount - 0.5) * barW},${saldoY(historical[historical.length - 1].saldoFinal ?? 0)}`] : []),
              ...forecast.map((m, i) => `${(pastCount + i + 0.5) * barW},${saldoY(m.saldoFinal)}`),
            ].join(" ")}
            fill="none" stroke="#4021c8" strokeWidth="1.5" strokeDasharray="4,3"
            strokeLinecap="round" strokeLinejoin="round" opacity={0.55} vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Dots */}
        {allMonths.map((m, i) => (
          <circle key={m.month} cx={(i + 0.5) * barW} cy={saldoY(m.saldo ?? 0)} r="1.5"
            fill="#4021c8" opacity={m.isForecast ? 0.4 : 0.9} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>

      {/* Month labels (show every 2nd or 3rd) */}
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

// ── Params panel ──────────────────────────────────────────────────────────────

function ParamField({ label, value, onChange, suffix = "€", step = 10, note }: {
  label: string; value: number; onChange: (v: number) => void;
  suffix?: string; step?: number; note?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-navy/50 mb-1">{label}</label>
      <div className="flex items-center gap-1.5 bg-navy/[0.03] border border-navy/[0.08] rounded-lg px-2.5 py-1.5">
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
          step={step}
          className="w-full bg-transparent text-sm font-semibold text-navy outline-none tabular-nums" />
        <span className="text-xs text-navy/40 shrink-0">{suffix}</span>
      </div>
      {note && <p className="text-[10px] text-navy/35 mt-0.5">{note}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type RowKey = "saldoInicial" | "entradas" | "salidas" | "resultado" | "saldoFinal";

const ROW_CONFIG: { key: RowKey; label: string; isSection?: boolean }[] = [
  { key: "entradas",    label: "Entradas",     isSection: true },
  { key: "salidas",     label: "Salidas",      isSection: true },
  { key: "saldoInicial",label: "Saldo inicial" },
  { key: "resultado",   label: "Resultado" },
  { key: "saldoFinal",  label: "Saldo final" },
];

function cellValue(
  row: RowKey,
  m: MonthlyActual | MonthlyForecast,
  isForecast: boolean,
): number | null {
  if (isForecast) {
    const f = m as MonthlyForecast;
    switch (row) {
      case "entradas":     return f.totalEntradas;
      case "salidas":      return f.totalSalidas;
      case "saldoInicial": return f.saldoInicial;
      case "resultado":    return f.resultado;
      case "saldoFinal":   return f.saldoFinal;
    }
  } else {
    const a = m as MonthlyActual;
    switch (row) {
      case "entradas":     return a.entradas;
      case "salidas":      return a.salidas;
      case "saldoInicial": return a.saldoInicial;
      case "resultado":    return a.resultado;
      case "saldoFinal":   return a.saldoFinal;
    }
  }
}

function cellColor(row: RowKey, value: number | null): string {
  if (value === null) return "text-navy/25";
  switch (row) {
    case "entradas":     return "text-income";
    case "salidas":      return "text-danger";
    case "resultado":    return value >= 0 ? "text-income" : "text-danger";
    case "saldoFinal":   return value >= 0 ? "text-navy" : "text-danger";
    default:             return "text-navy/65";
  }
}

function cellFormat(row: RowKey, value: number | null): string {
  if (value === null) return "—";
  switch (row) {
    case "entradas":  return "+" + fmtAmt(value);
    case "salidas":   return "−" + fmtAmt(value);
    case "resultado": return fmtSign(value);
    default:          return fmtAmt(value);
  }
}

export default function PrevisionesTable({
  baseMrr,
  packsBase,
  startingBalance,
  recurringExpenses,
  historical,
}: {
  baseMrr: number;
  packsBase: number;
  startingBalance: number;
  recurringExpenses: RecurringExpense[];
  historical: MonthlyActual[];
}) {
  const [showForecast, setShowForecast] = useState(true);
  const [scenarioId, setScenarioId] = useState("actual");
  const [showParams, setShowParams] = useState(false);
  const [params, setParams] = useState<ForecastParams>({
    mrrBase:           Math.round(baseMrr),
    packsBase:         Math.round(packsBase),
    crecimientoPct:    0,
    retencionesPct:    0,
    prestamo:          0,
    salarioAumentoPct: 0,
  });

  const tableRef = useRef<HTMLDivElement>(null);

  function set<K extends keyof ForecastParams>(key: K, val: ForecastParams[K]) {
    setParams(p => ({ ...p, [key]: val }));
  }

  const selectedScenario: CapacityScenario =
    CAPACITY_SCENARIOS.find(s => s.id === scenarioId) ?? CAPACITY_SCENARIOS[0];

  // Salary base from current recurring expenses (for delta display)
  const salaryBase = recurringExpenses.find(e => e.category === "Salarios")?.avgMonthly ?? 2660;

  const forecast = useMemo(() =>
    buildForecast(
      startingBalance,
      recurringExpenses,
      params,
      scenarioId !== "actual" ? selectedScenario.salariosMes : undefined,
    ),
    [startingBalance, recurringExpenses, params, scenarioId, selectedScenario],
  );

  // All months to display
  const pastMonths = historical;
  const futureMonths = showForecast ? forecast : [];
  const currentMonthIdx = pastMonths.findIndex(m => m.month >= TODAY_MONTH);
  const splitIdx = currentMonthIdx >= 0 ? currentMonthIdx : pastMonths.length;

  // Totals for KPIs (forecast 12m)
  const fcTotalEntradas  = forecast.reduce((s, m) => s + m.totalEntradas, 0);
  const fcTotalSalidas   = forecast.reduce((s, m) => s + m.totalSalidas, 0);
  const fcSaldoFinal     = forecast[forecast.length - 1]?.saldoFinal ?? startingBalance;

  return (
    <div className="space-y-5">

      {/* ── Scenario selector ── */}
      <div>
        <p className="text-xs font-semibold text-navy/45 uppercase tracking-wider mb-3">
          Escenario de capacidad
        </p>
        <ScenarioCards
          selected={scenarioId}
          onSelect={setScenarioId}
          currentSalaryBase={salaryBase}
        />
        {scenarioId !== "actual" && (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-xs bg-primary/[0.07] text-primary px-3 py-1 rounded-full">
              {selectedScenario.plazasMes} plazas/mes
            </span>
            <span className="text-xs bg-navy/[0.05] text-navy/60 px-3 py-1 rounded-full">
              Hasta {selectedScenario.maxAlumnos} alumnos al 85%
            </span>
            <span className="text-xs bg-danger/[0.07] text-danger px-3 py-1 rounded-full">
              +{fmt(selectedScenario.salariosMes - salaryBase)} € /mes en salarios
            </span>
          </div>
        )}
      </div>

      {/* ── KPIs + toggle ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4">
          <p className="text-xs text-navy/45 uppercase tracking-wider mb-1">Entradas 12m</p>
          <p className="text-lg font-semibold text-income tabular-nums">{fmtAmt(fcTotalEntradas)}</p>
        </div>
        <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4">
          <p className="text-xs text-navy/45 uppercase tracking-wider mb-1">Salidas 12m</p>
          <p className="text-lg font-semibold text-danger tabular-nums">{fmtAmt(fcTotalSalidas)}</p>
        </div>
        <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4">
          <p className="text-xs text-navy/45 uppercase tracking-wider mb-1">Saldo final</p>
          <p className={`text-lg font-semibold tabular-nums ${fcSaldoFinal >= 0 ? "text-navy" : "text-danger"}`}>
            {fmtAmt(fcSaldoFinal)}
          </p>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between mb-3 gap-3">
          <p className="text-xs font-semibold text-navy/55 uppercase tracking-wider">Evolución del saldo</p>
          {/* Toggle */}
          <button
            onClick={() => setShowForecast(v => !v)}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              showForecast
                ? "bg-primary/[0.08] border-primary/20 text-primary"
                : "bg-navy/[0.04] border-navy/10 text-navy/45 hover:text-navy"
            }`}
          >
            <span className={`w-2 h-2 rounded-full border ${showForecast ? "bg-primary border-primary" : "bg-transparent border-navy/30"}`} />
            Previsiones {showForecast ? "activadas" : "desactivadas"}
          </button>
        </div>

        <CombinedChart historical={historical} forecast={forecast} showForecast={showForecast} />

        <div className="flex items-center gap-4 mt-3 text-[10px] text-navy/40">
          <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-income/70 rounded-sm inline-block" /> Entradas</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-danger/70 rounded-sm inline-block" /> Salidas</span>
          <span className="flex items-center gap-1"><span className="w-5 border-t border-primary border-solid inline-block" /> Saldo real</span>
          {showForecast && <span className="flex items-center gap-1"><span className="w-5 border-t border-primary border-dashed inline-block opacity-55" /> Saldo previsto</span>}
        </div>
      </div>

      {/* ── Params (collapsible) ── */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card">
        <button
          onClick={() => setShowParams(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5"
        >
          <p className="text-xs font-semibold text-navy/55 uppercase tracking-wider">Ajustes de previsión</p>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-navy/40 transition-transform ${showParams ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {showParams && (
          <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-navy/[0.06] pt-4">
            <ParamField label="MRR base" value={params.mrrBase} onChange={v => set("mrrBase", v)} suffix="€/mes" step={50} note="Tiempo real desde Momence" />
            <ParamField label="Packs y clases" value={params.packsBase} onChange={v => set("packsBase", v)} suffix="€/mes" step={50} note="Media histórica Stripe" />
            <ParamField label="Crecimiento mensual" value={params.crecimientoPct} onChange={v => set("crecimientoPct", v)} suffix="%" step={0.5} />
            <ParamField label="Retenciones (IRPF)" value={params.retencionesPct} onChange={v => set("retencionesPct", v)} suffix="%" step={1} />
            <ParamField label="Préstamo" value={params.prestamo} onChange={v => set("prestamo", v)} suffix="€/mes" step={50} />
            <ParamField label="Aumento salarios" value={params.salarioAumentoPct} onChange={v => set("salarioAumentoPct", v)} suffix="%" step={1} note="Solo en escenario actual" />
          </div>
        )}
      </div>

      {/* ── Combined table ── */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
        <div ref={tableRef} className="overflow-x-auto">
          <table className="border-collapse" style={{ minWidth: `${(pastMonths.length + futureMonths.length) * 88 + 130}px` }}>
            <thead>
              <tr className="border-b border-navy/[0.07]">
                {/* Row label column */}
                <th className="sticky left-0 z-10 bg-white px-4 py-2.5 text-left text-xs font-semibold text-navy/40 uppercase tracking-wider w-[130px] min-w-[130px]" />
                {/* Past month headers */}
                {pastMonths.map((m) => (
                  <th key={m.month}
                    className={`px-3 py-2.5 text-center text-xs font-semibold whitespace-nowrap w-[88px] min-w-[88px] ${
                      m.month === TODAY_MONTH ? "text-primary" : "text-navy/55"
                    }`}
                  >
                    {m.label}
                  </th>
                ))}
                {/* Divider + forecast headers */}
                {showForecast && futureMonths.map((m, i) => (
                  <th key={m.month}
                    className={`px-3 py-2.5 text-center text-xs font-medium whitespace-nowrap text-navy/30 w-[88px] min-w-[88px] ${
                      i === 0 ? "border-l border-primary/20 border-dashed" : ""
                    }`}
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROW_CONFIG.map((row, ri) => (
                <tr
                  key={row.key}
                  className={`
                    ${row.isSection ? "border-t border-navy/[0.07]" : ""}
                    ${ri === ROW_CONFIG.length - 3 ? "border-t-2 border-navy/10" : ""}
                    hover:bg-navy/[0.01]
                  `}
                >
                  {/* Label */}
                  <td className={`sticky left-0 z-10 bg-white px-4 py-2.5 text-xs whitespace-nowrap ${
                    row.isSection ? "font-bold text-navy" : "font-medium text-navy/65"
                  }`}>
                    {row.label}
                  </td>

                  {/* Past cells */}
                  {pastMonths.map((m) => {
                    const val = cellValue(row.key, m, false);
                    return (
                      <td key={m.month}
                        className={`px-3 py-2.5 text-right text-xs tabular-nums whitespace-nowrap ${
                          m.month === TODAY_MONTH ? "bg-primary/[0.02]" : ""
                        } ${cellColor(row.key, val)} ${row.isSection ? "font-semibold" : ""}`}
                      >
                        {cellFormat(row.key, val)}
                      </td>
                    );
                  })}

                  {/* Forecast cells */}
                  {showForecast && futureMonths.map((m, i) => {
                    const val = cellValue(row.key, m, true);
                    return (
                      <td key={m.month}
                        className={`px-3 py-2.5 text-right text-xs tabular-nums whitespace-nowrap opacity-50 italic ${
                          i === 0 ? "border-l border-primary/20 border-dashed" : ""
                        } ${cellColor(row.key, val)} ${row.isSection ? "font-semibold" : ""}`}
                      >
                        {cellFormat(row.key, val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {showForecast && (
          <p className="text-[10px] text-navy/30 px-5 py-2.5 border-t border-navy/[0.04] italic">
            Columnas en cursiva = previsión estimada · Saldo inicial: {fmtAmt(startingBalance)} · MRR en tiempo real desde Momence
          </p>
        )}
      </div>
    </div>
  );
}
