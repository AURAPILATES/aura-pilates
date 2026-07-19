"use client";

import Link from "next/link";
import { TrendingUp, FileText } from "react-feather";
import { ChartCard } from "@/components/charts";

function fmt(v: number) {
  return Math.round(v).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export type CockpitFinancieroProps = {
  curMonthLabel: string;
  currentBalance: number | null;
  balanceDate: string | null;
  runwayMonths: number | null;
  avgMonthlyBurn: number;
  completeBurnMonthsCount: number;
  ventasPrevistas: number;
  gastosComprometidos: number;
  lastUpdated?: string | null;
  nextIvaLabel: string | null;
  nextIvaQuarter: string | null;
  ivaNeto: number;
  ivaSoportado: number;
  ivaRepercutido: number;
  retenciones: number;
  ivaQuarterClosed: boolean;
};

export default function CockpitFinanciero({
  curMonthLabel,
  currentBalance,
  balanceDate,
  runwayMonths,
  avgMonthlyBurn,
  completeBurnMonthsCount,
  ventasPrevistas,
  gastosComprometidos,
  lastUpdated,
  nextIvaLabel,
  nextIvaQuarter,
  ivaNeto,
  ivaSoportado,
  ivaRepercutido,
  retenciones,
  ivaQuarterClosed,
}: CockpitFinancieroProps) {
  const saldoProyectado = (currentBalance ?? 0) + ventasPrevistas - gastosComprometidos;

  return (
    <ChartCard
      title="Cockpit financiero"
      subtitle="Qué pasó, dónde estamos, a dónde vamos"
      dateRange={curMonthLabel}
      dataSource="Stripe API (ingresos) + CaixaBank CSV (gastos, saldo) + Recurrentes confirmados + IVA 21% ventas / IVA-retención por contacto (gastos)"
      sources={["stripe", "momence", "excel"]}
      lastUpdated={lastUpdated}
    >
      {/* 3-column section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#ececef]">

        {/* PRESENTE */}
        <div className="p-4 sm:pl-0">
          <div className="flex items-center gap-1.5 mb-4">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Presente</span>
          </div>
          <div className="mb-4">
            <div className="text-[11px] font-medium text-navy/45 mb-1">Saldo actual</div>
            <div className="text-[26px] font-medium text-navy leading-tight">
              {currentBalance !== null ? fmt(currentBalance) : "—"}
            </div>
            <div className="text-[11px] text-navy/50 mt-0.5">
              {balanceDate ? `últ. mov. ${fmtDate(balanceDate)}` : "sin datos bancarios"}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-navy/45 mb-1">Meses de caja</div>
            <div className="text-[20px] font-medium text-navy leading-tight">
              {runwayMonths !== null ? `${runwayMonths.toFixed(1)} m` : "—"}
            </div>
            <div className="text-[11px] text-navy/50 mt-0.5">
              {fmt(avgMonthlyBurn)}/mes · media {completeBurnMonthsCount} m
            </div>
          </div>
        </div>

        {/* FISCAL */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-4">
            <FileText size={12} className="text-navy/40" />
            <span className="text-[11px] font-semibold text-navy/40 uppercase tracking-wider">Fiscal</span>
          </div>
          <div className="mb-4">
            <div className="text-[11px] font-medium text-navy/45 mb-1">Previsión de IVA e IRPF</div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[26px] font-medium leading-tight ${ivaNeto >= 0 ? "text-navy" : "text-success"}`}>
                {fmt(Math.abs(ivaNeto))}
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                ivaNeto >= 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
              }`}>
                {ivaNeto >= 0 ? "A pagar" : "A favor"}
              </span>
            </div>
            <div className="text-[11px] text-navy/50 mt-1">
              Soportado {fmt(ivaSoportado)} · Repercutido {fmt(ivaRepercutido)}
            </div>
            <div className="text-[11px] text-navy/40 mt-0.5">
              IVA {nextIvaQuarter ?? "—"} · vence {nextIvaLabel ?? "—"}
              {!ivaQuarterClosed && " · parcial, trimestre en curso"}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-navy/45 mb-1">Retenciones (IRPF)</div>
            <div className="text-[20px] font-medium text-navy leading-tight">{fmt(retenciones)}</div>
            <div className="text-[11px] text-navy/45 mt-1">nóminas + alquileres</div>
          </div>
        </div>

        {/* FUTURO */}
        <div className="p-4 sm:pr-0">
          <div className="flex items-center gap-1.5 mb-4">
            <TrendingUp size={12} className="text-navy/40" />
            <span className="text-[11px] font-semibold text-navy/40 uppercase tracking-wider">Futuro</span>
          </div>
          <div className="mb-4">
            <div className="text-[11px] font-medium text-navy/45 mb-1">Saldo proyectado</div>
            <div className="text-[26px] font-medium text-navy leading-tight">~{fmt(saldoProyectado)}</div>
            <div className="text-[11px] text-navy/50 mt-0.5">saldo + previsto – comprometido · 30d</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-navy/45 mb-1">Previsión de ventas y pagos</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[18px] font-medium text-success leading-tight">~{fmt(ventasPrevistas)}</span>
              <span className="text-[13px] text-navy/40">−</span>
              <span className="text-[18px] font-medium text-danger leading-tight">{fmt(gastosComprometidos)}</span>
            </div>
            <div className="text-[11px] text-navy/50 mt-0.5">ventas media últ. 3m − gastos comprometidos</div>
            <Link href="/previsiones" className="text-[11px] text-primary hover:underline mt-1.5 inline-block">
              Ver previsión completa →
            </Link>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
