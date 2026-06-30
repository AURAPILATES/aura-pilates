"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "react-feather";
import { fmt } from "@/lib/analytics";
import { ChartCard, ToggleGroup } from "@/components/charts";
import type { RecurringForecast } from "@/lib/recurring";
import type { Category } from "@/lib/categories";

type SortKey = "fecha" | "categoria" | "importe";

type ListItem = RecurringForecast & { variable?: boolean; categoryLabel: string };

const MONTH_ES: Record<string, string> = {
  "01":"ene","02":"feb","03":"mar","04":"abr","05":"may","06":"jun",
  "07":"jul","08":"ago","09":"sep","10":"oct","11":"nov","12":"dic",
};

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

function weekLabel(nextDate: string): string {
  const [y, mm, dd] = nextDate.split("-");
  const day = parseInt(dd);
  const mon = MONTH_ES[mm] ?? mm;
  const yr  = y.slice(2);
  if (day <= 7)  return `1–7 ${mon} '${yr}`;
  if (day <= 14) return `8–14 ${mon} '${yr}`;
  if (day <= 21) return `15–21 ${mon} '${yr}`;
  return `22–31 ${mon} '${yr}`;
}

function weekOrder(nextDate: string): string {
  const [y, mm, dd] = nextDate.split("-");
  const bucket = parseInt(dd) <= 7 ? "1" : parseInt(dd) <= 14 ? "2" : parseInt(dd) <= 21 ? "3" : "4";
  return `${y}-${mm}-${bucket}`;
}

function groupByWeek(items: ListItem[]): { label: string; items: ListItem[]; subtotal: number }[] {
  const map = new Map<string, ListItem[]>();
  for (const item of items) {
    const key = weekOrder(item.nextDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, grpItems]) => ({
      label: weekLabel(grpItems[0].nextDate),
      items: grpItems,
      subtotal: grpItems.reduce((s, i) => s + Math.abs(i.amount), 0),
    }));
}

function ItemRow({ item }: { item: ListItem }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
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

  function categoryLabel(value: string | null): string {
    if (!value) return "";
    return categories.find((c) => c.value === value)?.label ?? value;
  }

  const committed    = forecasts.reduce((s, f) => s + Math.abs(f.amount), 0);
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

  // Pago más grande (punto 3)
  const biggest = items.length > 0
    ? items.reduce((max, i) => Math.abs(i.amount) > Math.abs(max.amount) ? i : max, items[0])
    : null;
  const biggestDays = biggest?.daysUntil ?? null;
  const biggestLabel =
    biggestDays === null ? null
    : biggestDays === 0  ? "hoy"
    : biggestDays === 1  ? "mañana"
    : `en ${biggestDays} días`;

  const sorted = [...items].sort((a, b) => {
    if (sort === "fecha")     return a.nextDate.localeCompare(b.nextDate);
    if (sort === "categoria") return a.categoryLabel.localeCompare(b.categoryLabel) || a.nextDate.localeCompare(b.nextDate);
    return Math.abs(b.amount) - Math.abs(a.amount);
  });

  const weekGroups = sort === "fecha" ? groupByWeek(sorted) : null;

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
          {/* Punto 3: pago más grande destacado */}
          {biggest && biggestLabel && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-navy/[0.03] rounded-lg">
              <AlertCircle size={13} className="shrink-0 text-navy/40" />
              <span className="text-xs text-navy/60">
                Mayor pago:{" "}
                <span className="font-semibold text-navy">{biggest.label}</span>
                {" · "}
                <span className="font-semibold text-navy tabular-nums">{fmt(Math.abs(biggest.amount))}</span>
                {" · "}
                <span className={biggestDays! <= 1 ? "text-warning font-medium" : ""}>{biggestLabel}</span>
              </span>
            </div>
          )}

          {/* Sort toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-navy/45">Ordenar por</span>
            <ToggleGroup
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: "fecha",     label: "Fecha" },
                { value: "categoria", label: "Categoría" },
                { value: "importe",   label: "Importe" },
              ]}
            />
          </div>

          {/* Punto 2: agrupación semanal cuando sort = fecha, lista plana en otros modos */}
          {weekGroups ? (
            <div className="space-y-4">
              {weekGroups.map((group) => (
                <div key={group.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-navy/40 uppercase tracking-wider">{group.label}</span>
                    <span className="text-[11px] font-semibold text-navy/40 tabular-nums">{fmt(group.subtotal)}</span>
                  </div>
                  <div className="divide-y divide-navy/[0.05]">
                    {group.items.map((item) => <ItemRow key={item.key} item={item} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-navy/[0.05]">
              {sorted.map((item) => <ItemRow key={item.key} item={item} />)}
            </div>
          )}

          {/* Footer total */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-navy/[0.07]">
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
