export interface CohortRow {
  label: string;
  /** tamaño del grupo inicial */
  n: number;
  /** % de retención por columna, en el mismo orden que `columns`; null = sin dato aún */
  values: Array<number | null>;
}

export interface CohortTableProps {
  /** etiquetas de columna después de "Entrada" (p. ej. ["M+1","M+2","M+3","M+4"]) */
  columns: string[];
  rows: CohortRow[];
  /** umbrales para los tramos de intensidad del heatmap */
  thresholds?: { high: number; mid: number };
  className?: string;
}

type Tier = "full" | "high" | "mid" | "low" | "empty";

const TIER_STYLES: Record<Tier, string> = {
  full: "bg-primary text-white",
  high: "bg-primary/60 text-white",
  mid: "bg-primary/30 text-primary",
  low: "bg-primary/10 text-primary",
  empty: "bg-navy/[0.04] text-navy/35",
};

function tierFor(value: number | null, thresholds: { high: number; mid: number }): Tier {
  if (value === null) return "empty";
  if (value >= 100) return "full";
  if (value >= thresholds.high) return "high";
  if (value >= thresholds.mid) return "mid";
  return "low";
}

export default function CohortTable({
  columns,
  rows,
  thresholds = { high: 35, mid: 20 },
  className = "",
}: CohortTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-max text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[10px] uppercase tracking-wide font-medium text-navy/50 px-1.5 py-1 border-b border-navy/[0.07]">
              Cohorte
            </th>
            <th className="text-left text-[10px] uppercase tracking-wide font-medium text-navy/50 px-1.5 py-1 border-b border-navy/[0.07]">
              N
            </th>
            <th className="text-left text-[10px] uppercase tracking-wide font-medium text-navy/50 px-1.5 py-1 border-b border-navy/[0.07]">
              Entrada
            </th>
            {columns.map((c) => (
              <th
                key={c}
                className="text-left text-[10px] uppercase tracking-wide font-medium text-navy/50 px-1.5 py-1 border-b border-navy/[0.07]"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="px-1.5 py-2 border-b border-navy/[0.07] font-medium text-navy whitespace-nowrap">
                {row.label}
              </td>
              <td className="px-1.5 py-2 border-b border-navy/[0.07] text-navy/55">{row.n}</td>
              <td className="px-1.5 py-2 border-b border-navy/[0.07]">
                <span className={`inline-flex items-center justify-center min-w-11 px-1.5 py-1 rounded-md text-xs font-medium tabular-nums ${TIER_STYLES.full}`}>
                  100%
                </span>
              </td>
              {columns.map((c, i) => {
                const value = row.values[i] ?? null;
                const tier = tierFor(value, thresholds);
                return (
                  <td key={c} className="px-1.5 py-2 border-b border-navy/[0.07]">
                    <span
                      className={`inline-flex items-center justify-center min-w-11 px-1.5 py-1 rounded-md text-xs font-medium tabular-nums ${TIER_STYLES[tier]}`}
                    >
                      {value === null ? "—" : `${value}%`}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
