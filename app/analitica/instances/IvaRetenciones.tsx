"use client";

import { useState } from "react";
import { ChevronRight } from "react-feather";
import { ChartCard, type MultiKpiItem } from "@/components/charts";
import Drawer from "@/app/components/Drawer";
import { fmt } from "@/lib/analytics";

export type FiscalTxnItem = {
  date: string;
  label: string;
  base: number;
  amount: number;
};

export type QuarterlyFiscalRow = {
  quarter: string;
  ivaRepercutido: number;
  ivaSoportado: number;
  ivaNeto: number;
  retenciones: number;
  soportadoTxns: FiscalTxnItem[];
  retencionTxns: FiscalTxnItem[];
  repercutidoByMonth: { month: string; amount: number }[];
};

export type FiscalObligation = {
  label: string;
  deadline: string;
  days: number;
};

type Props = {
  quarterLabel: string;
  ivaRepercutido: number;
  ivaSoportado: number;
  ivaNeto: number;
  retenciones: number;
  dueLabel: string;
  quarterClosed: boolean;
  rows: QuarterlyFiscalRow[];
  obligations: FiscalObligation[];
  lastUpdated?: string | null;
};

type Metric = "repercutido" | "soportado" | "retencion" | "ivaNeto" | "total";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Formatea "2026-Q3" como "T3 2026". */
function quarterShort(q: string): string {
  const [year, qn] = q.split("-Q");
  return `T${qn} ${year}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MESES[parseInt(m, 10) - 1]} ${y}`;
}

function fmtDate(d: string): string {
  return d.split("-").reverse().join("/");
}

function fmtOrDash(v: number): string {
  return v === 0 ? "-" : fmt(v);
}

const MONTH_SHORT = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function urgencyOf(days: number): "danger" | "warning" | "neutral" {
  if (days <= 30) return "danger";
  if (days <= 60) return "warning";
  return "neutral";
}

const URGENCY_STYLES = {
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  neutral: "bg-navy/5 text-navy/70",
} as const;

function ObligationDayBadge({ deadline, level }: { deadline: string; level: keyof typeof URGENCY_STYLES }) {
  const d = new Date(deadline + "T12:00:00");
  return (
    <div className={`w-9 h-9 shrink-0 rounded-[8px] flex flex-col items-center justify-center ${URGENCY_STYLES[level]}`}>
      <span className="text-[12px] font-semibold leading-none">{d.getDate()}</span>
      <span className="text-[7.5px] font-semibold uppercase tracking-wide mt-0.5">{MONTH_SHORT[d.getMonth()]}</span>
    </div>
  );
}

/** Badge "A pagar"/"A favor" - igual paleta semántica que el resto de la app (success/danger). */
function ResultBadge({ favorable }: { favorable: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-semibold ${
        favorable ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      {favorable ? "A favor" : "A pagar"}
    </span>
  );
}

/** Celda de la tabla clicable para explorar su detalle. Si el valor es 0 no hay nada que
 * explorar, así que se muestra como texto plano. */
function DrillCell({ zero, onClick, className = "", children }: { zero: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  if (zero) return <span className={className}>{children}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-1 -mx-1 hover:bg-navy/[0.05] hover:underline underline-offset-2 decoration-navy/30 transition-colors cursor-pointer ${className}`}
    >
      {children}
    </button>
  );
}

export default function IvaRetenciones({
  quarterLabel, ivaRepercutido, ivaSoportado, ivaNeto, retenciones, dueLabel, quarterClosed, rows, obligations, lastUpdated,
}: Props) {
  const [ivaExpanded, setIvaExpanded] = useState(false);
  const [selected, setSelected] = useState<{ row: QuarterlyFiscalRow; metric: Metric } | null>(null);
  const quarterStatus = quarterClosed ? "trimestre cerrado" : "trimestre en curso";

  const kpiItems: MultiKpiItem[] = [
    {
      label: `IVA · ${quarterStatus}`,
      value: (
        <span className="inline-flex items-center gap-2">
          {fmt(Math.abs(ivaNeto))}
          <ResultBadge favorable={ivaNeto < 0} />
        </span>
      ),
      valueClassName: ivaNeto < 0 ? "text-success" : "text-navy",
      tooltip: "Repercutido: 21% extraído del bruto de ventas (Stripe + Urban Sports Club). Soportado: según el % de IVA asignado por contacto en cada gasto importado (Configuración → Contactos). Excluye movimientos de Efectivo Aura (no se declara). Resultado = repercutido − soportado.",
      helper: (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-navy/45">
          <span>Repercutido (Ventas) {fmt(ivaRepercutido)}</span>
          <span>Soportado (Gastos) {fmt(ivaSoportado)}</span>
        </div>
      ),
    },
    {
      label: `IRPF · ${quarterStatus}`,
      value: fmt(retenciones),
      tooltip: "Retenciones practicadas según el % de IRPF asignado por contacto (nóminas, alquileres, profesionales) en cada gasto importado. Excluye movimientos de Efectivo Aura (no se declara).",
    },
  ];

  return (
    <ChartCard
      title="Impuestos aproximados"
      subtitle={`Próximo vencimiento: ${dueLabel}`}
      dateRange={quarterLabel}
      kpiItems={kpiItems}
      dataSource="IVA repercutido: 21% extraído del bruto de ventas (Stripe + USC). IVA soportado y retenciones: según el % de IVA/IRPF asignado por contacto en cada gasto importado. Excluye movimientos de Efectivo Aura, que no se declara."
      sources={["stripe", "excel"]}
      lastUpdated={lastUpdated}
    >
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-navy/55 uppercase tracking-wide">Por trimestre</p>
            <span className="text-[11px] text-navy/35">· toca una celda para ver el detalle</span>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-navy/40">Todavía no hay movimientos con IVA o retención asignados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-medium text-navy/45 pb-2 pr-3"></th>
                    {rows.map((r) => (
                      <th key={r.quarter} className="text-right font-medium text-navy/45 pb-2 px-3 whitespace-nowrap">
                        {quarterShort(r.quarter)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2.5 pr-3 text-navy/50 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setIvaExpanded((v) => !v)}
                        className="flex items-center gap-1 hover:text-navy/70 transition-colors"
                      >
                        <ChevronRight size={13} className={`shrink-0 text-navy/35 transition-transform ${ivaExpanded ? "rotate-90" : ""}`} />
                        IVA
                      </button>
                    </td>
                    {rows.map((r) => (
                      <td key={r.quarter} className={`py-2.5 px-3 text-right tabular-nums ${r.ivaNeto < 0 ? "text-success" : "text-navy/70"}`}>
                        <DrillCell zero={r.ivaNeto === 0} onClick={() => setSelected({ row: r, metric: "ivaNeto" })}>
                          {fmtOrDash(r.ivaNeto)}
                        </DrillCell>
                      </td>
                    ))}
                  </tr>
                  {ivaExpanded && (
                    <>
                      <tr className="border-b border-border">
                        <td className="py-2 pl-4 pr-3 text-navy/50 whitespace-nowrap">Repercutido (Ventas)</td>
                        {rows.map((r) => (
                          <td key={r.quarter} className="py-2 px-3 text-right text-navy/70 tabular-nums">
                            <DrillCell zero={r.ivaRepercutido === 0} onClick={() => setSelected({ row: r, metric: "repercutido" })}>
                              {fmtOrDash(r.ivaRepercutido)}
                            </DrillCell>
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 pl-4 pr-3 text-navy/50 whitespace-nowrap">Soportado (Gastos)</td>
                        {rows.map((r) => (
                          <td key={r.quarter} className="py-2 px-3 text-right text-navy/70 tabular-nums">
                            <DrillCell zero={r.ivaSoportado === 0} onClick={() => setSelected({ row: r, metric: "soportado" })}>
                              {r.ivaSoportado === 0 ? "-" : `− ${fmt(r.ivaSoportado)}`}
                            </DrillCell>
                          </td>
                        ))}
                      </tr>
                    </>
                  )}
                  <tr className="border-b border-border">
                    <td className="py-2.5 pr-3 text-navy/50 whitespace-nowrap">IRPF</td>
                    {rows.map((r) => (
                      <td key={r.quarter} className="py-2.5 px-3 text-right text-navy/70 tabular-nums">
                        <DrillCell zero={r.retenciones === 0} onClick={() => setSelected({ row: r, metric: "retencion" })}>
                          {fmtOrDash(r.retenciones)}
                        </DrillCell>
                      </td>
                    ))}
                  </tr>
                  <tr className="last:border-0 bg-navy/[0.035]">
                    <td className="py-2.5 pr-3 font-semibold text-navy whitespace-nowrap rounded-l-[6px]">Total</td>
                    {rows.map((r, i) => {
                      const total = r.ivaNeto + r.retenciones;
                      return (
                        <td
                          key={r.quarter}
                          className={`py-2.5 px-3 text-right font-semibold text-navy tabular-nums ${i === rows.length - 1 ? "rounded-r-[6px]" : ""}`}
                        >
                          <DrillCell zero={total === 0} onClick={() => setSelected({ row: r, metric: "total" })}>
                            {fmtOrDash(total)}
                          </DrillCell>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold text-navy/40 uppercase tracking-wide mb-2">Próximas obligaciones</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {obligations.map((o) => {
              const level = urgencyOf(o.days);
              return (
                <div key={o.label} className="flex items-center gap-2 rounded-[8px] border border-border px-2.5 py-2">
                  <ObligationDayBadge deadline={o.deadline} level={level} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-navy/80 truncate">{o.label}</p>
                    <p className="text-[11px] text-navy/45">{o.days < 0 ? `Venció hace ${-o.days} d` : o.days === 0 ? "Vence hoy" : `En ${o.days} días`}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected && <DetailDrawer selected={selected} onClose={() => setSelected(null)} />}
    </ChartCard>
  );
}

// ── Drawer de detalle por celda ─────────────────────────────────────────────────

function DetailDrawer({ selected, onClose }: { selected: { row: QuarterlyFiscalRow; metric: Metric }; onClose: () => void }) {
  const { row, metric } = selected;
  const q = quarterShort(row.quarter);

  // Métricas "hoja": lista de items concretos que suman la cifra.
  const leaf: Record<"repercutido" | "soportado" | "retencion", { title: string; value: number; note: string; items: { label: string; sub?: string; amount: number }[] }> = {
    repercutido: {
      title: "IVA repercutido",
      value: row.ivaRepercutido,
      note: "21% extraído del bruto de ventas (Stripe + Urban Sports Club), por mes. Excluye Efectivo Aura.",
      items: row.repercutidoByMonth.map((m) => ({ label: monthLabel(m.month), amount: m.amount })),
    },
    soportado: {
      title: "IVA soportado",
      value: row.ivaSoportado,
      note: "IVA de los gastos, según el % asignado a cada contacto. Excluye Efectivo Aura.",
      items: row.soportadoTxns.map((t) => ({ label: t.label, sub: `${fmtDate(t.date)} · base ${fmt(t.base)}`, amount: t.amount })),
    },
    retencion: {
      title: "IRPF retenido",
      value: row.retenciones,
      note: "Retenciones practicadas, según el % de IRPF asignado a cada contacto. Excluye Efectivo Aura.",
      items: row.retencionTxns.map((t) => ({ label: t.label, sub: `${fmtDate(t.date)} · base ${fmt(t.base)}`, amount: t.amount })),
    },
  };

  const isLeaf = metric === "repercutido" || metric === "soportado" || metric === "retencion";

  // Métricas compuestas: desglose en sus componentes.
  const composite: Record<"ivaNeto" | "total", { title: string; value: number; favorable?: boolean; parts: { label: string; amount: number }[]; resultLabel: string }> = {
    ivaNeto: {
      title: "IVA a pagar (neto)",
      value: row.ivaNeto,
      favorable: row.ivaNeto < 0,
      parts: [
        { label: "Repercutido (Ventas)", amount: row.ivaRepercutido },
        { label: "Soportado (Gastos)", amount: -row.ivaSoportado },
      ],
      resultLabel: "IVA neto",
    },
    total: {
      title: "Total del trimestre",
      value: row.ivaNeto + row.retenciones,
      parts: [
        { label: "IVA (neto)", amount: row.ivaNeto },
        { label: "IRPF (retenciones)", amount: row.retenciones },
      ],
      resultLabel: "Total",
    },
  };

  const head = isLeaf ? leaf[metric as "repercutido" | "soportado" | "retencion"] : composite[metric as "ivaNeto" | "total"];

  return (
    <Drawer
      maxWidth="max-w-[420px]"
      header={
        <div>
          <p className="text-[11px] font-semibold text-navy/40 uppercase tracking-wide">{q}</p>
          <h2 className="text-base font-semibold text-navy mt-0.5">{head.title}</h2>
          <p className="text-sm text-navy/55 mt-0.5">{fmt(Math.abs(head.value))}</p>
        </div>
      }
      onClose={onClose}
    >
      {isLeaf ? (
        <div>
          <p className="px-6 pt-4 pb-2 text-xs text-navy/45">{leaf[metric as "repercutido" | "soportado" | "retencion"].note}</p>
          {leaf[metric as "repercutido" | "soportado" | "retencion"].items.length === 0 ? (
            <p className="px-6 py-8 text-sm text-navy/45">Sin detalle disponible para este trimestre.</p>
          ) : (
            leaf[metric as "repercutido" | "soportado" | "retencion"].items.map((it, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3.5 border-b border-navy/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{it.label}</p>
                  {it.sub && <p className="text-xs text-navy/55 mt-0.5">{it.sub}</p>}
                </div>
                <p className="text-sm font-semibold tabular-nums shrink-0 text-navy">{fmt(it.amount)}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="px-6 py-4">
          <p className="text-xs text-navy/45 mb-3">
            {metric === "ivaNeto" ? "Repercutido − Soportado." : "IVA neto + IRPF retenido."}
          </p>
          <div className="space-y-1">
            {composite[metric as "ivaNeto" | "total"].parts.map((p) => (
              <div key={p.label} className="flex items-center justify-between py-2 border-b border-navy/5">
                <span className="text-sm text-navy/70">{p.label}</span>
                <span className={`text-sm font-medium tabular-nums ${p.amount < 0 ? "text-success" : "text-navy"}`}>
                  {p.amount < 0 ? `− ${fmt(Math.abs(p.amount))}` : fmt(p.amount)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2.5">
              <span className="text-sm font-semibold text-navy">{composite[metric as "ivaNeto" | "total"].resultLabel}</span>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-navy tabular-nums">
                {metric === "ivaNeto" && <ResultBadge favorable={row.ivaNeto < 0} />}
                {fmt(Math.abs(composite[metric as "ivaNeto" | "total"].value))}
              </span>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
