"use client";

import { useState, useMemo } from "react";
import { buildForecast, type RecurringExpense, type ForecastParams, type MonthlyForecast } from "@/lib/previsiones";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(n: number, forceSign = false) {
  const s = Math.abs(n).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (forceSign) return (n >= 0 ? "+" : "−") + s + " €";
  return s + " €";
}

function clsx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ── Param input ───────────────────────────────────────────────────────────────

function ParamField({
  label, value, onChange, suffix = "€", min = 0, step = 10, note,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  step?: number;
  note?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-navy/50 mb-1">{label}</label>
      <div className="flex items-center gap-1.5 bg-navy/[0.03] border border-navy/[0.08] rounded-lg px-2.5 py-1.5">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          step={step}
          className="w-full bg-transparent text-sm font-semibold text-navy outline-none tabular-nums"
        />
        <span className="text-xs text-navy/40 shrink-0">{suffix}</span>
      </div>
      {note && <p className="text-[10px] text-navy/35 mt-0.5">{note}</p>}
    </div>
  );
}

// ── Chart ─────────────────────────────────────────────────────────────────────

function SaldoChart({ forecast }: { forecast: MonthlyForecast[] }) {
  const balances = forecast.map((m) => m.saldoFinal);
  const min = Math.min(...balances, 0);
  const max = Math.max(...balances);
  const range = max - min || 1;
  const H = 80;
  const W = 100;

  const pts = forecast.map((m, i) => {
    const x = (i / (forecast.length - 1)) * W;
    const y = H - ((m.saldoFinal - min) / range) * H;
    return `${x},${y}`;
  });

  const zeroY = H - ((0 - min) / range) * H;
  const isPositive = forecast[forecast.length - 1].saldoFinal >= 0;
  const color = isPositive ? "#298a83" : "#e53935";

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-16">
        {min < 0 && (
          <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="#94a3b8" strokeWidth="0.4" strokeDasharray="2,1" />
        )}
        <polyline
          points={pts.join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {forecast.map((m, i) => {
          const x = (i / (forecast.length - 1)) * W;
          const y = H - ((m.saldoFinal - min) / range) * H;
          return <circle key={i} cx={x} cy={y} r="1.2" fill={color} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PrevisionesTable({
  baseMrr,
  packsBase,
  startingBalance,
  recurringExpenses,
}: {
  baseMrr: number;
  packsBase: number;
  startingBalance: number;
  recurringExpenses: RecurringExpense[];
}) {
  const [params, setParams] = useState<ForecastParams>({
    mrrBase:          Math.round(baseMrr),
    packsBase:        Math.round(packsBase),
    crecimientoPct:   0,
    retencionesPct:   0,
    prestamo:         0,
    salarioAumentoPct: 0,
  });
  const [showParams, setShowParams] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  function set<K extends keyof ForecastParams>(key: K, val: ForecastParams[K]) {
    setParams((p) => ({ ...p, [key]: val }));
  }

  const forecast = useMemo(
    () => buildForecast(startingBalance, recurringExpenses, params),
    [startingBalance, recurringExpenses, params],
  );

  const totalEntradas = forecast.reduce((s, m) => s + m.totalEntradas, 0);
  const totalSalidas  = forecast.reduce((s, m) => s + m.totalSalidas, 0);
  const totalResultado = forecast.reduce((s, m) => s + m.resultado, 0);

  return (
    <div className="space-y-6">

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Entradas 12m", value: totalEntradas, color: "text-income" },
          { label: "Salidas 12m",  value: totalSalidas,  color: "text-danger"  },
          { label: "Resultado",    value: totalResultado, color: totalResultado >= 0 ? "text-income" : "text-danger" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4">
            <p className="text-xs text-navy/45 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-lg sm:text-xl font-semibold tabular-nums ${color}`}>
              {fmtAmt(value)}
            </p>
          </div>
        ))}
      </div>

      {/* ── Chart ── */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-navy/55 uppercase tracking-wider">Evolución del saldo</p>
          <span className="text-xs text-navy/40">
            {fmtAmt(startingBalance)} → {fmtAmt(forecast[forecast.length - 1].saldoFinal)}
          </span>
        </div>
        <SaldoChart forecast={forecast} />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-navy/35">{forecast[0].label}</span>
          <span className="text-[10px] text-navy/35">{forecast[forecast.length - 1].label}</span>
        </div>
      </div>

      {/* ── Params panel ── */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card">
        <button
          onClick={() => setShowParams((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <p className="text-xs font-semibold text-navy/55 uppercase tracking-wider">Parámetros</p>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-navy/40 transition-transform ${showParams ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showParams && (
          <div className="px-5 pb-5 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-navy/[0.06] pt-4">
            <ParamField
              label="MRR base (suscripciones)"
              value={params.mrrBase}
              onChange={(v) => set("mrrBase", v)}
              suffix="€/mes"
              step={50}
              note="Desde Momence en tiempo real"
            />
            <ParamField
              label="Packs y clases sueltas"
              value={params.packsBase}
              onChange={(v) => set("packsBase", v)}
              suffix="€/mes"
              step={50}
              note="Media histórica de Stripe"
            />
            <ParamField
              label="Crecimiento mensual"
              value={params.crecimientoPct}
              onChange={(v) => set("crecimientoPct", v)}
              suffix="%"
              step={0.5}
              note="Se aplica acumulado mes a mes"
            />
            <ParamField
              label="Retenciones (IRPF)"
              value={params.retencionesPct}
              onChange={(v) => set("retencionesPct", v)}
              suffix="%"
              step={1}
              note="% descontado de los ingresos"
            />
            <ParamField
              label="Amortización préstamo"
              value={params.prestamo}
              onChange={(v) => set("prestamo", v)}
              suffix="€/mes"
              step={50}
              note="Cuota mensual fija"
            />
            <ParamField
              label="Aumento salarios"
              value={params.salarioAumentoPct}
              onChange={(v) => set("salarioAumentoPct", v)}
              suffix="%"
              step={1}
              note="Sobre la base histórica"
            />
          </div>
        )}
      </div>

      {/* ── Monthly table ── */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/[0.07]">
                {["Mes","Saldo inicial","Entradas","Salidas","Resultado","Saldo final"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-navy/45 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {forecast.map((m) => {
                const expanded = expandedMonth === m.month;
                const isNegResult = m.resultado < 0;
                const isNegFinal  = m.saldoFinal < 0;

                return (
                  <>
                    <tr
                      key={m.month}
                      className="border-b border-navy/[0.04] hover:bg-navy/[0.02] cursor-pointer transition-colors"
                      onClick={() => setExpandedMonth(expanded ? null : m.month)}
                    >
                      <td className="px-4 py-3 font-medium text-navy whitespace-nowrap">{m.label}</td>
                      <td className="px-4 py-3 tabular-nums text-navy/65 whitespace-nowrap">
                        {fmtAmt(m.saldoInicial)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-income font-medium whitespace-nowrap">
                        +{fmtAmt(m.totalEntradas)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-danger whitespace-nowrap">
                        −{fmtAmt(m.totalSalidas)}
                      </td>
                      <td className={clsx("px-4 py-3 tabular-nums font-semibold whitespace-nowrap", isNegResult ? "text-danger" : "text-income")}>
                        {fmtAmt(m.resultado, true)}
                      </td>
                      <td className={clsx("px-4 py-3 tabular-nums font-bold whitespace-nowrap", isNegFinal ? "text-danger" : "text-navy")}>
                        {fmtAmt(m.saldoFinal)}
                      </td>
                      <td className="px-2 py-3">
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          className={`text-navy/30 transition-transform ${expanded ? "rotate-180" : ""}`}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </td>
                    </tr>

                    {expanded && (
                      <tr key={`${m.month}-detail`} className="bg-navy/[0.015] border-b border-navy/[0.07]">
                        <td colSpan={7} className="px-4 pb-4 pt-2">
                          <div className="grid sm:grid-cols-2 gap-4 text-xs">
                            {/* Entradas */}
                            <div>
                              <p className="font-semibold text-navy/60 uppercase tracking-wider mb-2">Entradas</p>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-navy/55">MRR suscripciones</span>
                                  <span className="tabular-nums text-income font-medium">{fmtAmt(m.mrr)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-navy/55">Packs y clases</span>
                                  <span className="tabular-nums text-income font-medium">{fmtAmt(m.packs)}</span>
                                </div>
                                {m.retenciones > 0 && (
                                  <div className="flex justify-between text-warning/80">
                                    <span>Retenciones (−)</span>
                                    <span className="tabular-nums">−{fmtAmt(m.retenciones)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between border-t border-navy/[0.08] pt-1 font-semibold text-income">
                                  <span>Total entradas</span>
                                  <span className="tabular-nums">{fmtAmt(m.totalEntradas)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Salidas */}
                            <div>
                              <p className="font-semibold text-navy/60 uppercase tracking-wider mb-2">Salidas</p>
                              <div className="space-y-1">
                                {m.expenses.map((e) => (
                                  <div key={e.category} className="flex justify-between">
                                    <span className="text-navy/55">{e.category}</span>
                                    <span className="tabular-nums text-danger/80">{fmtAmt(e.amount)}</span>
                                  </div>
                                ))}
                                {m.prestamo > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-navy/55">Préstamo</span>
                                    <span className="tabular-nums text-danger/80">{fmtAmt(m.prestamo)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between border-t border-navy/[0.08] pt-1 font-semibold text-danger">
                                  <span>Total salidas</span>
                                  <span className="tabular-nums">{fmtAmt(m.totalSalidas)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy/[0.10] bg-navy/[0.02]">
                <td className="px-4 py-3 text-xs font-bold text-navy/60 uppercase tracking-wider">Total</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 tabular-nums text-income font-bold text-sm">+{fmtAmt(totalEntradas)}</td>
                <td className="px-4 py-3 tabular-nums text-danger font-bold text-sm">−{fmtAmt(totalSalidas)}</td>
                <td className={clsx("px-4 py-3 tabular-nums font-bold text-sm", totalResultado >= 0 ? "text-income" : "text-danger")}>
                  {fmtAmt(totalResultado, true)}
                </td>
                <td className="px-4 py-3 tabular-nums font-bold text-navy text-sm">
                  {fmtAmt(forecast[forecast.length - 1].saldoFinal)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-xs text-navy/35 text-center pb-2">
        Saldo inicial: {fmtAmt(startingBalance)} · Gastos basados en media histórica de transacciones · MRR en tiempo real desde Momence
      </p>
    </div>
  );
}
