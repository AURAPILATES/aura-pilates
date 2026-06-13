"use client";
import { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/analytics";

type Props = {
  currentBalance: number | null;
  balanceDate: string | null;
  runwayMonths: number | null;
  avgMonthlyBurn: number;
  completeBurnMonthsCount: number;
  resultadoMes: number;
  breakEvenGap: number;
  avgMonthlyRevenue: number;
  clientesNecesarios: number | null;
  curMonthLabel: string;
};

function runwayColor(r: number | null) {
  if (r === null) return "text-navy/20";
  if (r < 3) return "text-danger";
  if (r < 6) return "text-warning";
  return "text-success";
}

export default function HealthCards(props: Props) {
  const {
    currentBalance, balanceDate, runwayMonths, avgMonthlyBurn,
    completeBurnMonthsCount, resultadoMes, breakEvenGap,
    avgMonthlyRevenue, clientesNecesarios, curMonthLabel,
  } = props;

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showStrip, setShowStrip] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStrip(!entry.isIntersecting),
      { rootMargin: "-56px 0px 0px 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rColor = runwayColor(runwayMonths);

  return (
    <>
      {/* ── Compact sticky strip (appears when cards scroll off) ── */}
      <div
        className={`fixed top-14 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-b border-navy/10
          transition-all duration-200 ease-out
          ${showStrip ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"}`}
      >
        <div className="max-w-6xl mx-auto px-6 py-2.5 grid grid-cols-2 sm:grid-cols-4 divide-x divide-navy/5">
          <div className="px-4 first:pl-0">
            <p className="text-[10px] text-navy/30 uppercase tracking-widest">Saldo</p>
            <p className="text-sm font-semibold text-navy tabular-nums">
              {currentBalance !== null ? fmt(currentBalance) : "—"}
            </p>
          </div>
          <div className="px-4">
            <p className="text-[10px] text-navy/30 uppercase tracking-widest">Runway</p>
            <p className={`text-sm font-semibold tabular-nums ${rColor}`}>
              {runwayMonths !== null ? `${runwayMonths.toFixed(1)} m` : "—"}
            </p>
          </div>
          <div className="px-4">
            <p className="text-[10px] text-navy/30 uppercase tracking-widest">Resultado {curMonthLabel}</p>
            <p className={`text-sm font-semibold tabular-nums ${resultadoMes >= 0 ? "text-success" : "text-danger"}`}>
              {resultadoMes >= 0 ? "+" : "−"}{fmt(Math.abs(resultadoMes))}
            </p>
          </div>
          <div className="px-4">
            <p className="text-[10px] text-navy/30 uppercase tracking-widest">Break-even</p>
            {avgMonthlyRevenue > 0 ? (
              breakEvenGap <= 0
                ? <p className="text-sm font-semibold text-success">Rentable</p>
                : <p className="text-sm font-semibold text-danger tabular-nums">−{fmt(breakEvenGap)}</p>
            ) : (
              <p className="text-sm font-semibold text-navy/20">Sin ventas</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Cards (normal flow) ── */}
      <div ref={sentinelRef} className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">

        {/* Saldo */}
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-3">Saldo en cuenta</p>
          {currentBalance !== null ? (
            <>
              <p className="text-2xl font-semibold text-navy tabular-nums">{fmt(currentBalance)}</p>
              {balanceDate && (
                <p className="text-[10px] text-navy/30 mt-1.5">
                  Último mov. {balanceDate.split("-").reverse().join("/")}
                </p>
              )}
            </>
          ) : (
            <p className="text-2xl font-semibold text-navy/20">—</p>
          )}
        </div>

        {/* Runway */}
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-3">Runway</p>
          {runwayMonths !== null ? (
            <>
              <p className={`text-2xl font-semibold tabular-nums ${rColor}`}>
                {runwayMonths.toFixed(1)} meses
              </p>
              <div className="flex gap-0.5 mt-3">
                {Array.from({ length: 12 }).map((_, i) => {
                  const filled = i < Math.round(runwayMonths);
                  const bar = runwayMonths < 3 ? "bg-danger" : runwayMonths < 6 ? "bg-warning" : "bg-success";
                  return <div key={i} className={`h-1.5 flex-1 rounded-sm ${filled ? bar : "bg-navy/5"}`} />;
                })}
              </div>
              <p className="text-[10px] text-navy/25 mt-1.5">
                Coste fijo {fmt(avgMonthlyBurn)}/mes · media {completeBurnMonthsCount} m
              </p>
            </>
          ) : (
            <p className="text-2xl font-semibold text-navy/20">—</p>
          )}
        </div>

        {/* Resultado mes */}
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-3">
            Resultado {curMonthLabel}
          </p>
          <p className={`text-2xl font-semibold tabular-nums ${resultadoMes >= 0 ? "text-success" : "text-danger"}`}>
            {resultadoMes >= 0 ? "+" : "−"}{fmt(Math.abs(resultadoMes))}
          </p>
          <p className="text-[10px] text-navy/30 mt-1.5">ingresos − gastos</p>
        </div>

        {/* Break-even */}
        <div className="bg-white border border-navy/10 rounded shadow-card p-5">
          <p className="text-[11px] font-semibold text-navy/35 uppercase tracking-wider mb-3">Break-even</p>
          {avgMonthlyRevenue > 0 ? (
            breakEvenGap <= 0 ? (
              <>
                <p className="text-2xl font-semibold text-success">Rentable</p>
                <p className="text-[10px] text-success/60 mt-1.5">+{fmt(Math.abs(breakEvenGap))}/mes margen</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold text-danger tabular-nums">−{fmt(breakEvenGap)}</p>
                <p className="text-[10px] text-navy/30 mt-1.5">al mes para cubrir costes</p>
                {clientesNecesarios && (
                  <p className="text-[10px] text-warning font-medium mt-0.5">≈ {clientesNecesarios} clientes más</p>
                )}
              </>
            )
          ) : (
            <p className="text-2xl font-semibold text-navy/20">Sin ventas</p>
          )}
        </div>

      </div>
    </>
  );
}
