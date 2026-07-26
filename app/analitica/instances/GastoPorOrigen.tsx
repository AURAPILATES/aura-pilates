"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartCard } from "@/components/charts";
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

function fmtDate(d: string) {
  return d.split("-").reverse().join("/");
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
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-[10px] border border-border bg-card text-sm font-medium text-navy hover:bg-subtle transition-colors"
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
