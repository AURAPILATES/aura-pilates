"use client";

import { useState } from "react";
import Link from "next/link";
import { fmt } from "@/lib/analytics";
import { ChartCard, ToggleGroup, ProportionBar } from "@/components/charts";
import type { RecurringForecast } from "@/lib/recurring";
import type { Category } from "@/lib/categories";

type SortKey = "fecha" | "importe";

type ListItem = RecurringForecast & { variable?: boolean; categoryLabel: string; categoryColor: string };

function nextMid15(): string {
  const now = new Date();
  const addMonth = now.getDate() >= 15;
  const m = addMonth ? now.getMonth() + 1 : now.getMonth();
  const y = m > 11 ? now.getFullYear() + 1 : now.getFullYear();
  return `${y}-${String((m % 12) + 1).padStart(2, "0")}-15`;
}

function fmtDate(d: string): string {
  const [, mm, dd] = d.split("-");
  return `${dd}/${mm}`;
}

function ItemRow({ item }: { item: ListItem }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-1.5 -mx-1.5 rounded-md hover:bg-navy/[0.025] transition-colors">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.categoryColor }} />
      <p className="text-[13px] font-medium text-navy truncate flex-1 min-w-0">{item.label}</p>
      {item.variable && (
        <span className="shrink-0 text-[10px] font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded">
          variable
        </span>
      )}
      <span className="hidden sm:block shrink-0 text-[11px] text-navy/45 bg-navy/[0.045] px-1.5 py-0.5 rounded truncate max-w-[110px]">
        {item.categoryLabel}
      </span>
      <span className="text-xs tabular-nums shrink-0 w-10 text-right text-navy/40">
        {item.variable ? `~${fmtDate(item.nextDate)}` : fmtDate(item.nextDate)}
      </span>
      <span className="text-[13px] font-semibold text-navy tabular-nums shrink-0 w-16 text-right">
        {fmt(Math.abs(item.amount))}
      </span>
    </div>
  );
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

  const FALLBACK_COLOR = "var(--color-faint)";

  function categoryLabel(value: string | null): string {
    if (!value) return "";
    return categories.find((c) => c.value === value)?.label ?? value;
  }

  function categoryColor(value: string | null): string {
    if (!value) return FALLBACK_COLOR;
    return categories.find((c) => c.value === value)?.text_color ?? FALLBACK_COLOR;
  }

  // La tarjeta dice "Próximos 30 días" - solo excluye lo que vence más allá de esa ventana (un
  // seguro anual, p.ej.). No hay estado "vencido": un recurrente con daysUntil negativo (el
  // banco puede tardar en subirse) se trata igual que cualquier otro, sin marcarlo ni avisar -
  // se ordena junto al resto por fecha, en silencio.
  const upcomingForecasts = forecasts.filter((f) => f.daysUntil <= 30);

  const committed    = upcomingForecasts.reduce((s, f) => s + Math.abs(f.amount), 0);
  const totalPrevisto = committed + avgSuministros;

  const items: ListItem[] = [
    ...upcomingForecasts.map((f) => ({ ...f, categoryLabel: categoryLabel(f.category), categoryColor: categoryColor(f.category) })),
    ...(avgSuministros > 0
      ? [{
          key: "__suministros__",
          label: "Suministros",
          category: "suministros",
          categoryLabel: "Local",
          categoryColor: categoryColor("suministros"),
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
    if (sort === "fecha") return a.nextDate.localeCompare(b.nextDate);
    return Math.abs(b.amount) - Math.abs(a.amount);
  });

  return (
    <ChartCard
      title="Previsión de gastos recurrentes"
      dateRange="Próximos 30 días"
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mb-4">
            <div className="shrink-0">
              <p className="text-[11px] font-medium text-navy/45 mb-1 whitespace-nowrap">Total previsto</p>
              <p className="text-[26px] font-semibold text-navy leading-tight tracking-tight">{fmt(totalPrevisto)}</p>
              <p className="text-[11px] text-navy/50 mt-0.5 whitespace-nowrap">{items.length} pagos previstos</p>
            </div>
            {totalPrevisto > 0 && (
              <div className="flex-1 min-w-0 w-full">
                <ProportionBar
                  segments={[
                    { label: "Comprometido", color: "var(--color-navy)", percentage: Math.round((committed / totalPrevisto) * 100), displayValue: fmt(committed) },
                    ...(avgSuministros > 0
                      ? [{ label: "Variable", color: "var(--color-warning)", percentage: Math.round((avgSuministros / totalPrevisto) * 100), displayValue: fmt(avgSuministros) }]
                      : []),
                  ]}
                />
              </div>
            )}
          </div>

          {/* Sort toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-navy/45">Ordenar por</span>
            <ToggleGroup
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: "fecha",     label: "Fecha" },
                { value: "importe",   label: "Importe" },
              ]}
            />
          </div>

          <div>
            {sorted.map((item) => <ItemRow key={item.key} item={item} />)}
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
