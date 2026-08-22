"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartCard, CollapsibleTable } from "@/components/charts";
import Drawer from "@/app/components/Drawer";
import { fmt, pct } from "@/lib/analytics";
import { OriginIcon, originLabel } from "@/app/transacciones/TransaccionesList";
import type { PaymentMethod } from "@/lib/transactions";

export type OriginSpend = {
  origin: PaymentMethod;
  total: number;
  count: number;
  txns: { date: string; amount: number; concept: string; contact: string }[];
};

// Color por origen, alineado con los colores que ya usa cada socio/efectivo en la app
// (ver SOCIO_INITIALS / OriginIcon). La identidad la dan el icono + la etiqueta de cada fila;
// el color es refuerzo, no el único canal.
const ORIGIN_COLORS: Record<string, string> = {
  banco:    "#0891B2",
  efectivo: "#B45309",
  victor:   "#6D28D9",
  celia:    "#BE185D",
  olga:     "#047857",
  carles:   "#1D4ED8",
};
const FALLBACK_COLOR = "#64748B";

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${Number(day)} ${MESES[Number(m) - 1]} ${y}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS_ES[parseInt(m, 10) - 1]}'${y.slice(2)}`;
}

/** Suma de gasto por mes (YYYY-MM) de un origen, a partir de sus transacciones. */
function spendByMonth(o: OriginSpend): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of o.txns) {
    const k = t.date.slice(0, 7);
    m.set(k, (m.get(k) ?? 0) + Math.abs(t.amount));
  }
  return m;
}

/** Desglose del dinero gastado por origen de pago (banco, efectivo, socios) en el período
 * seleccionado, para ver de un vistazo por qué canal sale cada euro y poder filtrar sus
 * movimientos. */
export default function GastoPorOrigen({
  origins,
  rangeLabel,
  lastUpdated,
}: {
  origins: OriginSpend[];
  rangeLabel?: string | null;
  lastUpdated?: string | null;
}) {
  const [selected, setSelected] = useState<OriginSpend | null>(null);

  const total = origins.reduce((s, o) => s + o.total, 0);
  const max = origins.reduce((m, o) => Math.max(m, o.total), 0);

  // Columnas de la tabla: los meses presentes dentro del período que se está viendo.
  const months = [...new Set(origins.flatMap((o) => o.txns.map((t) => t.date.slice(0, 7))))].sort();
  const originMonthly = origins.map((o) => ({ origin: o.origin, total: o.total, byMonth: spendByMonth(o) }));
  const monthColTotals = months.map((m) => originMonthly.reduce((s, o) => s + (o.byMonth.get(m) ?? 0), 0));

  const selectedTxns = selected
    ? [...selected.txns].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <ChartCard
      title="Gasto por origen de pago"
      subtitle="En qué cuenta o de quién sale cada euro que gastas — banco, efectivo o socios"
      dateRange={rangeLabel ?? undefined}
      kpi={{ value: fmt(total) }}
      dataSource="Salidas de dinero del período (importe negativo), excluyendo traspasos internos. Banco desde la exportación de CaixaBank; efectivo y socios desde altas manuales."
      sources={["excel"]}
      lastUpdated={lastUpdated}
    >
      {origins.length === 0 ? (
        <p className="text-sm text-navy/45 py-8 text-center">Sin gastos registrados en este período.</p>
      ) : (
        <div className="space-y-0.5 mt-1">
          {origins.map((o) => {
            const color = ORIGIN_COLORS[o.origin] ?? FALLBACK_COLOR;
            const share = total > 0 ? o.total / total : 0;
            const barW = max > 0 ? (o.total / max) * 100 : 0;
            return (
              <button
                key={o.origin}
                type="button"
                onClick={() => setSelected(o)}
                className="w-full text-left rounded-lg px-2 py-2 -mx-2 hover:bg-navy/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="shrink-0 flex items-center justify-center w-[18px]">
                    <OriginIcon method={o.origin} size={15} />
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-navy">{originLabel(o.origin)}</span>
                  <span className="shrink-0 text-[13px] font-semibold text-navy tabular-nums">{fmt(o.total)}</span>
                  <span className="shrink-0 w-9 text-right text-[11px] text-navy/45 tabular-nums">{pct(share)}</span>
                </div>
                <div className="ml-[26px] h-2.5 rounded-full bg-navy/[0.05] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${barW}%`, backgroundColor: color }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {origins.length > 0 && (
        <CollapsibleTable>
          <table className="w-full min-w-max text-xs">
            <thead>
              <tr className="border-b border-navy/[0.07]">
                <th className="text-left py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide">Origen</th>
                {months.map((m) => (
                  <th key={m} className="text-right py-2 pr-3 text-navy/45 font-semibold uppercase tracking-wide whitespace-nowrap">
                    {monthLabel(m)}
                  </th>
                ))}
                <th className="text-right py-2 text-navy/45 font-semibold uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {originMonthly.map((o) => (
                <tr key={o.origin} className="border-b border-navy/[0.04]">
                  <td className="py-1.5 pr-3 text-navy whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: ORIGIN_COLORS[o.origin] ?? FALLBACK_COLOR }} />
                      {originLabel(o.origin)}
                    </span>
                  </td>
                  {months.map((m) => (
                    <td key={m} className="py-1.5 pr-3 text-right text-navy/80 tabular-nums">
                      {o.byMonth.get(m) ? fmt(o.byMonth.get(m)!) : "-"}
                    </td>
                  ))}
                  <td className="py-1.5 text-right text-navy font-semibold tabular-nums">{fmt(o.total)}</td>
                </tr>
              ))}
              <tr className="border-t border-navy/[0.12] bg-navy/[0.025]">
                <td className="py-2 pr-3 text-navy font-semibold whitespace-nowrap">Total</td>
                {monthColTotals.map((v, i) => (
                  <td key={months[i]} className="py-2 pr-3 text-right text-navy font-semibold tabular-nums">{v ? fmt(v) : "-"}</td>
                ))}
                <td className="py-2 text-right text-navy font-bold tabular-nums">{fmt(total)}</td>
              </tr>
            </tbody>
          </table>
        </CollapsibleTable>
      )}

      {selected && (
        <Drawer
          maxWidth="max-w-[420px]"
          header={
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-navy/[0.05] flex items-center justify-center shrink-0">
                <OriginIcon method={selected.origin} size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-navy">{originLabel(selected.origin)}</h2>
                <p className="text-xs text-navy/55 mt-0.5">{fmt(selected.total)} · {selected.count} transacci{selected.count === 1 ? "ón" : "ones"}</p>
              </div>
            </div>
          }
          footer={
            <Link
              href={`/transacciones?origen=${encodeURIComponent(selected.origin)}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[8px] border border-border bg-card text-sm font-medium text-navy hover:bg-subtle transition-colors"
            >
              Ver transacciones
            </Link>
          }
          onClose={() => setSelected(null)}
        >
          {selectedTxns.length === 0 ? (
            <p className="text-sm text-navy/45 px-6 py-8">Sin transacciones registradas.</p>
          ) : (
            selectedTxns.map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3.5 border-b border-navy/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{t.contact || t.concept || "-"}</p>
                  <p className="text-xs text-navy/55 mt-0.5">{fmtDate(t.date)}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0 text-navy">{fmt(Math.abs(t.amount))}</p>
              </div>
            ))
          )}
        </Drawer>
      )}
    </ChartCard>
  );
}
