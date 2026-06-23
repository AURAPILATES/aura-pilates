import { fmt } from "@/lib/analytics";
import { ChartCard } from "@/components/charts";
import type { RecurringForecast } from "@/lib/recurring";
import type { Category } from "@/lib/categories";

function fmtDate(d: string): string {
  return d.split("-").reverse().join("/");
}

function dueLabel(daysUntil: number): { text: string; className: string } {
  if (daysUntil < 0) return { text: `vencido hace ${Math.abs(daysUntil)}d`, className: "text-warning" };
  if (daysUntil === 0) return { text: "hoy", className: "text-danger font-medium" };
  if (daysUntil <= 7) return { text: `en ${daysUntil}d`, className: "text-warning" };
  return { text: `en ${daysUntil}d`, className: "text-navy/50" };
}

type Props = {
  forecasts: RecurringForecast[];
  categories: Category[];
};

export default function PrevisionGastos({ forecasts, categories }: Props) {
  const next30 = forecasts.filter((f) => f.daysUntil <= 30);
  const totalNext30 = next30.reduce((s, f) => s + Math.abs(f.amount), 0);
  const overdueCount = forecasts.filter((f) => f.daysUntil < 0).length;

  function categoryLabel(value: string | null): string | null {
    if (!value) return null;
    return categories.find((c) => c.value === value)?.label ?? value;
  }

  return (
    <ChartCard
      title="Previsión de gastos recurrentes"
      subtitle="Próximos pagos detectados automáticamente por importe, contacto y periodicidad"
      kpiItems={[
        { label: "Próximos 30 días", value: fmt(totalNext30), helper: `${next30.length} pagos previstos` },
        { label: "Gastos detectados", value: String(forecasts.length), helper: "series recurrentes activas" },
        ...(overdueCount > 0
          ? [{ label: "Vencidos", value: String(overdueCount), valueClassName: "text-warning", helper: "sin registrar aún" }]
          : []),
      ]}
      dataSource="Detectado por importe, contacto/concepto y periodicidad repetida en los movimientos bancarios"
    >
      {forecasts.length === 0 ? (
        <p className="text-sm text-navy/45 text-center py-6">Sin gastos recurrentes detectados todavía.</p>
      ) : (
        <div className="divide-y divide-navy/[0.05]">
          {forecasts.map((f) => {
            const due = dueLabel(f.daysUntil);
            const cat = categoryLabel(f.category);
            return (
              <div key={f.key} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{f.label}</p>
                  <p className="text-xs text-navy/45 truncate">
                    {f.period}{cat ? ` · ${cat}` : ""} · {f.occurrences} pagos · último {fmtDate(f.lastDate)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-navy tabular-nums">{fmt(Math.abs(f.amount))}</p>
                  <p className={`text-xs tabular-nums ${due.className}`}>{due.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartCard>
  );
}
