"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { BarChart2, Activity } from "react-feather";
import type { Sale } from "@/lib/sales";
import type { Transaction } from "@/lib/transactions";
import { ChartCard, ChartTypeToggle, ToggleGroup, Legend } from "@/components/charts";
import type { VolumenBrutoRow } from "./VolumenBrutoBody";

const VolumenBrutoBody = dynamic(() => import("./VolumenBrutoBody"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

type Period = "dia" | "semana" | "mes" | "trimestre" | "año";

const PERIODS: { key: Period; label: string }[] = [
  { key: "dia", label: "Día" },
  { key: "semana", label: "Semana" },
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
  "Alquiler", "Salarios", "Seguridad social", "Electricidad", "Agua", "Software", "Gestoría y legal",
  "Impuestos y tasas", "IVA", "IRPF", "IS", "Teléfono", "Seguros", "Comisiones bancarias", "Merchandising",
  "Local", "Otros", "Inversión", "Material y maquinaria", "Mobiliario", "Reforma",
]);

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const dow = (d.getDay() + 6) % 7;
  const thu = new Date(d);
  thu.setDate(d.getDate() - dow + 3);
  const jan1 = new Date(thu.getFullYear(), 0, 1);
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return `${thu.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getPeriodKey(date: string, period: Period): string {
  const [y, m] = date.split("-");
  switch (period) {
    case "dia": return date;
    case "semana": return isoWeek(date);
    case "mes": return `${y}-${m}`;
    case "trimestre": return `${y}-Q${Math.ceil(parseInt(m) / 3)}`;
    case "año": return y;
  }
}

function formatLabel(key: string, period: Period): string {
  switch (period) {
    case "dia": {
      const [, m, d] = key.split("-");
      return `${d}/${m}`;
    }
    case "semana": {
      const [y, w] = key.split("-");
      return `${w}'${y.slice(2)}`;
    }
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

export default function VolumenBruto({ sales, txns }: { sales: Sale[]; txns: Transaction[] }) {
  const [period, setPeriod] = useState<Period>("mes");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const data = groupData(sales, txns, period);

  return (
    <ChartCard
      title="Ingresos y gastos"
      subtitle="Volumen bruto de ingresos (Momence) frente a gastos (exportación bancaria) por período"
      toolbar={
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <ChartTypeToggle
              value={chartType}
              onChange={(v) => setChartType(v as "bar" | "line")}
              options={[
                { value: "bar", label: "Ver como barras", icon: <BarChart2 size={14} /> },
                { value: "line", label: "Ver como línea", icon: <Activity size={14} /> },
              ]}
            />
            <Legend items={[{ label: "Ingresos", color: "#818CF8" }, { label: "Gastos", color: "#FCA5A5" }]} />
          </div>
          <ToggleGroup
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </>
      }
      chartDescription="Evolución de ingresos y gastos por período seleccionado"
      dataSource="Ingresos: Momence sales.csv · Gastos: exportación bancaria CaixaBank"
      sources={["momence", "excel"]}
    >
      <VolumenBrutoBody data={data} chartType={chartType} />

      <div className="mt-5 overflow-x-auto">
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
      </div>
    </ChartCard>
  );
}
