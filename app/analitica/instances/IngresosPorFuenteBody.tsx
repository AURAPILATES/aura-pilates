"use client";

import {
  ResponsiveContainer, ComposedChart, Bar, Line, CartesianGrid,
  XAxis, YAxis, Tooltip, type TooltipContentProps,
} from "recharts";

export type IngresosPorFuenteRow = {
  month: string;
  label: string;
  stripeGross: number;
  stripeFees: number;
  stripeNet: number;
  /** € de Urban EFECTIVO usado por el gráfico/tabla: el del banco (real) si ese mes ya se
   * facturó; si no, el estimado (check-ins × tarifa) para no dejar hueco en el mes en curso. */
  uscNet: number;
  /** € REAL de Urban según el banco ese mes (0 si aún no llegó la transferencia). */
  uscBank: number;
  /** Clases de Urban asistidas ese mes (check-ins, Momence v2 en vivo). */
  urbanClasses: number;
  /** € estimado = clases × tarifa pactada vigente (ver [[project-momence-sales-migration]]). */
  urbanEstimated: number;
  /** true si uscNet viene del estimado (el banco aún no ingresó ese mes) → dato provisional. */
  urbanIsEstimated: boolean;
};

const COLOR_STRIPE = "var(--chart-violet-1)";
const COLOR_USC    = "var(--color-warning)";

function fmtEur(v: number) {
  return Math.round(v).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

function fmtTick(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${Math.round(v)}`;
}

function FuenteTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as IngresosPorFuenteRow;
  return (
    <div className="bg-card border border-border rounded-[8px] shadow-lg px-3 py-2 text-xs min-w-[160px]">
      <p className="font-semibold text-navy mb-1.5">{row.label}</p>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: COLOR_STRIPE }} />
        <span className="text-navy/55">Stripe</span>
        <span className="font-semibold text-navy ml-auto">{fmtEur(row.stripeGross)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: COLOR_USC }} />
        <span className="text-navy/55">Urban{row.urbanIsEstimated ? " (est.)" : ""}</span>
        <span className="font-semibold text-navy ml-auto">{fmtEur(row.uscNet)}</span>
      </div>
      {row.urbanIsEstimated ? (
        <p className="text-[10px] text-navy/40 mt-1 pl-3.5 max-w-[190px]">
          {row.urbanClasses} clases × tarifa, en vivo de Momence. Provisional: Urban paga a mes vencido; al llegar su transferencia pasará al importe real.
        </p>
      ) : row.uscNet > 0 ? (
        <p className="text-[10px] text-navy/40 mt-1 pl-3.5 max-w-[190px]">
          Transferencia real del banco, asignada a este mes (Urban paga sus clases a mes vencido).
          {row.urbanClasses > 0 && ` ${row.urbanClasses} clases.`}
        </p>
      ) : null}
    </div>
  );
}

export default function IngresosPorFuenteBody({
  data,
  chartType,
  onBarClick,
}: {
  data: IngresosPorFuenteRow[];
  chartType: "bar" | "line";
  onBarClick?: (month: string, source: "stripe" | "urban") => void;
}) {
  if (data.length === 0) return <p className="text-sm text-navy/45 text-center py-10">Sin datos</p>;

  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="4 3" stroke="color-mix(in srgb, var(--color-navy) 7%, transparent)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "color-mix(in srgb, var(--color-navy) 45%, transparent)" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtTick} tick={{ fontSize: 10, fill: "color-mix(in srgb, var(--color-navy) 45%, transparent)" }} tickLine={false} axisLine={false} width={34} />
          <Tooltip content={FuenteTooltip} cursor={chartType === "bar" ? { fill: "color-mix(in srgb, var(--color-navy) 4%, transparent)" } : { stroke: "color-mix(in srgb, var(--color-navy) 20%, transparent)", strokeDasharray: "4 3" }} />
          {chartType === "bar" ? (
            <>
              <Bar
                dataKey="stripeGross" name="Stripe" stackId="a" fill={COLOR_STRIPE} radius={[0, 0, 0, 0]}
                cursor={onBarClick ? "pointer" : undefined}
                onClick={onBarClick ? (d: { payload?: IngresosPorFuenteRow }) => d.payload && onBarClick(d.payload.month, "stripe") : undefined}
              />
              <Bar
                dataKey="uscNet" name="Urban" stackId="a" fill={COLOR_USC} radius={[2, 2, 0, 0]}
                cursor={onBarClick ? "pointer" : undefined}
                onClick={onBarClick ? (d: { payload?: IngresosPorFuenteRow }) => d.payload && onBarClick(d.payload.month, "urban") : undefined}
              />
            </>
          ) : (
            <>
              <Line type="monotone" dataKey="stripeGross" name="Stripe" stroke={COLOR_STRIPE} strokeWidth={2} dot={{ r: 3, fill: COLOR_STRIPE, stroke: "white", strokeWidth: 1.5 }} activeDot={{ r: 4.5 }} />
              <Line type="monotone" dataKey="uscNet"      name="Urban"  stroke={COLOR_USC}    strokeWidth={2} dot={{ r: 3, fill: COLOR_USC,    stroke: "white", strokeWidth: 1.5 }} activeDot={{ r: 4.5 }} />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
