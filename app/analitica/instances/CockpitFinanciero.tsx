"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { TrendingUp, FileText } from "react-feather";
import type { Sale } from "@/lib/sales";
import type { Transaction } from "@/lib/transactions";
import { ChartCard, ToggleGroup, Legend, CollapsibleTable } from "@/components/charts";
import type { VolumenBrutoRow } from "./VolumenBrutoBody";

const VolumenBrutoBody = dynamic(() => import("./VolumenBrutoBody"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

type Period = "mes" | "trimestre" | "año";

const PERIODS: { key: Period; label: string }[] = [
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año", label: "Año" },
];

const MONTH_NAMES: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

const EXPENSE_CATS = new Set([
  "Alquiler","Salarios","Seguridad social","Electricidad","Agua","Software","Gestoría y legal",
  "Impuestos y tasas","IVA","IRPF","IS","Teléfono","Seguros","Comisiones bancarias","Merchandising",
  "Local","Otros","Inversión","Material y maquinaria","Mobiliario","Reforma",
]);

function getPeriodKey(date: string, period: Period): string {
  const [y, m] = date.split("-");
  switch (period) {
    case "mes": return `${y}-${m}`;
    case "trimestre": return `${y}-Q${Math.ceil(parseInt(m) / 3)}`;
    case "año": return y;
  }
}

function formatLabel(key: string, period: Period): string {
  switch (period) {
    case "mes": {
      const [y, m] = key.split("-");
      return `${MONTH_NAMES[m] ?? m}'${y.slice(2)}`;
    }
    case "trimestre": return key.replace("-", " ");
    case "año": return key;
  }
}

function groupData(sales: Sale[], txns: Transaction[], period: Period): VolumenBrutoRow[] {
  const map = new Map<string, { income: number; expense: number }>();

  for (const s of sales) {
    const key = getPeriodKey(s.paymentDate, period);
    const p = map.get(key) ?? { income: 0, expense: 0 };
    map.set(key, { ...p, income: p.income + s.amount });
  }

  for (const t of txns) {
    if (t.amount >= 0 || !t.category || !EXPENSE_CATS.has(t.category)) continue;
    const key = getPeriodKey(t.date, period);
    const p = map.get(key) ?? { income: 0, expense: 0 };
    map.set(key, { ...p, expense: p.expense + Math.abs(t.amount) });
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { income, expense }]) => ({ key, label: formatLabel(key, period), income, expense }));
}

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
  sales: Sale[];
  txns: Transaction[];
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
  sales,
  txns,
  lastUpdated,
  nextIvaLabel,
  nextIvaQuarter,
  ivaNeto,
  ivaSoportado,
  ivaRepercutido,
  retenciones,
  ivaQuarterClosed,
}: CockpitFinancieroProps) {
  const [period, setPeriod] = useState<Period>("mes");

  const saldoProyectado = (currentBalance ?? 0) + ventasPrevistas - gastosComprometidos;

  const data = groupData(sales, txns, period);

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
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-navy/[0.07] border border-navy/[0.07] rounded-xl mb-6">

        {/* PRESENTE */}
        <div className="p-4">
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
        <div className="p-4">
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

      {/* Chart */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-navy">Evolución histórica</p>
            <Legend items={[{ label: "Ingresos", color: "#818CF8" }, { label: "Gastos", color: "#FCA5A5" }]} />
          </div>
          <ToggleGroup
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </div>
        <VolumenBrutoBody data={data} chartType="bar" />
      </div>

      <CollapsibleTable>
        <table className="w-full min-w-max text-xs">
          <thead>
            <tr className="border-b border-navy/[0.07]">
              <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Período</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Ingresos</th>
              <th className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Gastos</th>
              <th className="text-right py-2 text-navy/45 font-semibold uppercase tracking-wide">Margen</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const margin = row.income - row.expense;
              return (
                <tr key={row.key} className="border-b border-navy/[0.04] last:border-0">
                  <td className="py-2 pr-3 text-navy/70 whitespace-nowrap">{row.label}</td>
                  <td className="py-2 pr-3 text-right text-navy tabular-nums">{fmt(row.income)}</td>
                  <td className="py-2 pr-3 text-right text-navy tabular-nums">{fmt(row.expense)}</td>
                  <td className={`py-2 text-right font-medium tabular-nums ${margin >= 0 ? "text-success" : "text-danger"}`}>
                    {margin >= 0 ? "+" : ""}{fmt(margin)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CollapsibleTable>
    </ChartCard>
  );
}
