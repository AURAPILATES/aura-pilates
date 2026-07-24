"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import type { Transaction } from "@/lib/transactions";
import { findCategory } from "@/lib/transactions";
import { NON_CASHFLOW_GROUP_TYPES, type Category } from "@/lib/categories";
import { ChartCard, ChartTypeToggle, ToggleGroup, Legend, CollapsibleTable, type MultiKpiItem } from "@/components/charts";
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

function fmtEur(v: number) {
  return Math.round(v).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

function groupData(txns: Transaction[], categories: Category[], period: Period): VolumenBrutoRow[] {
  const map = new Map<string, { income: number; expense: number }>();

  for (const t of txns) {
    const cat = t.category ? findCategory(categories, t.category) : undefined;
    if (cat && NON_CASHFLOW_GROUP_TYPES.has(cat.group_type)) continue;

    const key = getPeriodKey(t.date, period);
    const p = map.get(key) ?? { income: 0, expense: 0 };
    if (t.amount >= 0) {
      map.set(key, { ...p, income: p.income + t.amount });
    } else {
      map.set(key, { ...p, expense: p.expense + Math.abs(t.amount) });
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { income, expense }]) => ({ key, label: formatLabel(key, period), income, expense }));
}

export default function VolumenBruto({
  txns,
  categories,
  lastUpdated,
  kpiItems,
  dateRange,
}: {
  txns: Transaction[];
  categories: Category[];
  lastUpdated?: string | null;
  kpiItems?: MultiKpiItem[];
  /** Label del período global del filtro (p.ej. "2026"), para que el badge sea consistente
   * con el resto de cards; el toggle interno mes/trim/año reagrupa dentro de ese período. */
  dateRange?: string;
}) {
  const [period, setPeriod] = useState<Period>("mes");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const data = groupData(txns, categories, period);

  return (
    <ChartCard
      title="Flujo de caja"
      subtitle="Entradas y salidas brutas de dinero según el banco, sin conciliar con Momence ni Stripe"
      dateRange={dateRange}
      kpiItems={kpiItems}
      toolbar={
        <div className="flex items-center justify-between gap-3 w-full flex-nowrap">
          <ChartTypeToggle
            value={chartType}
            onChange={(v) => setChartType(v as "bar" | "line")}
            options={[
              { value: "bar", label: "Ver como barras", icon: <BarChart2 size={14} /> },
              { value: "line", label: "Ver como línea", icon: <Activity size={14} /> },
            ]}
          />
          <ToggleGroup
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </div>
      }
      chartDescription="Evolución de entradas y salidas de caja por período seleccionado"
      dataSource="Bruto: todo movimiento bancario de entrada o salida, excluyendo traspasos internos. No concilia con Momence/Stripe — por eso es flujo de caja, no resultado contable."
      sources={["excel"]}
      lastUpdated={lastUpdated}
    >
      <Legend items={[{ label: "Ingresos", color: "#818CF8" }, { label: "Gastos", color: "#FCA5A5" }]} className="mb-3" />
      <VolumenBrutoBody data={data} chartType={chartType} />

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
                  <td className="py-2 pr-3 text-right text-navy tabular-nums">{fmtEur(row.income)}</td>
                  <td className="py-2 pr-3 text-right text-navy tabular-nums">{fmtEur(row.expense)}</td>
                  <td className={`py-2 text-right font-medium tabular-nums ${margin >= 0 ? "text-success" : "text-danger"}`}>
                    {margin >= 0 ? "+" : ""}{fmtEur(margin)}
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
