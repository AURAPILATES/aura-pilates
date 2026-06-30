"use client";

import { useState } from "react";
import Link from "next/link";
import { fmt } from "@/lib/analytics";
import { ChartCard, ToggleGroup } from "@/components/charts";
import type { RecurringForecast } from "@/lib/recurring";
import type { Category } from "@/lib/categories";

type SortKey = "fecha" | "categoria" | "importe";

type ListItem = RecurringForecast & { variable?: boolean; categoryLabel: string };

function nextMid15(): string {
  const now = new Date();
  const y = now.getDate() >= 15 ? (now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()) : now.getFullYear();
  const m = now.getDate() >= 15 ? (now.getMonth() + 1) % 12 : now.getMonth();
  return `${y}-${String(m + 1).padStart(2, "0")}-15`;
}

function fmtDate(d: string): string {
  const [, mm, dd] = d.split("-");
  return `${dd}/${mm}`;
}

export default function PrevisionGastos({
  forecasts,
  categories,
  avgSuministros,
}: {
  forecasts: RecurringForecast[];
  categories: Category[];
  avgSuministros: number;
}) {
  const [sort, setSort] = useState<SortKey>("fecha");

  function categoryLabel(value: string | null): string {
    if (!value) return "";
    return categories.find((c) => c.value === value)?.label ?? value;
  }

  const committed = forecasts.reduce((s, f) => s + Math.abs(f.amount), 0);
  const totalPrevisto = committed + avgSuministros;

  const items: ListItem[] = [
    ...forecasts.map((f) => ({ ...f, categoryLabel: categoryLabel(f.category) })),
    ...(avgSuministros > 0
      ? [{
          key: "__suministros__",
          label: "Suministros",
          category: "suministros",
          categoryLabel: "Local",
          period: "mensual",
          amount: -avgSuministros,
          lastDate: "",
          nextDate: nextMid15(),
          daysUntil: 15,
          occurrences: 0,
          variable: true as const,
        }]
      : []),
  ];

  const sorted = [...items].sort((a, b) => {
    if (sort === "fecha")     return a.nextDate.localeCompare(b.nextDate);
    if (sort === "categoria") return a.categoryLabel.localeCompare(b.categoryLabel);
    return Math.abs(b.amount) - Math.abs(a.amount);
  });

  return (
    <ChartCard
      title="Previsión de gastos recurrentes"
      subtitle="Próximos 30 días"
      dateRange="próximos 30 días"
      kpiItems={[
        {
          label: "Total previsto",
          value: fmt(totalPrevisto),
          helper: `${items.length} pagos previstos`,
        },
        {
          label: "Comprometido",
          value: fmt(committed),
          helper: "importe fijo conocido",
        },
        ...(avgSuministros > 0
          ? [{
              label: "Variable",
              value: fmt(avgSuministros),
              valueClassName: "text-warning",
              helper: "suministros · media últ. 3m",
            }]
          : []),
      ]}
      dataSource="Gastos recurrentes confirmados en Transacciones › Recurrentes. Suministros: media de los últimos 3 meses completos (Electricidad + Agua)."
      sources={["recurrentes"]}
    >
      {items.length === 0 ? (
        <p className="text-sm text-navy/45 text-center py-6">
          Sin gastos recurrentes confirmados.{" "}
          <Link href="/transacciones?tab=recurrentes" className="text-primary hover:underline">Gestionarlos →</Link>
        </p>
      ) : (
        <>
          {/* Sort toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-navy/45">Ordenar por</span>
            <ToggleGroup
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: "categoria", label: "Categoría" },
                { value: "fecha",     label: "Fecha" },
                { value: "importe",   label: "Importe" },
              ]}
            />
          </div>

          {/* List */}
          <div className="divide-y divide-navy/[0.05]">
            {sorted.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-navy truncate">{item.label}</p>
                    {item.variable && (
                      <span className="shrink-0 text-[10px] font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                        variable
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-navy/45 truncate">{item.categoryLabel}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-navy tabular-nums">{fmt(Math.abs(item.amount))}</p>
                  <p className="text-xs text-navy/40 tabular-nums">
                    {item.variable ? `~${fmtDate(item.nextDate)}` : fmtDate(item.nextDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer total */}
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-navy/[0.07]">
            <span className="text-xs text-navy/50">Total previsto · 30 días</span>
            <span className="text-sm font-semibold text-navy tabular-nums">{fmt(totalPrevisto)}</span>
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-3">
        <Link href="/transacciones?tab=recurrentes" className="text-xs text-primary hover:underline">
          Gestionar recurrentes →
        </Link>
        <span className="text-xs text-navy/35">Transacciones › Recurrentes</span>
      </div>
    </ChartCard>
  );
}
