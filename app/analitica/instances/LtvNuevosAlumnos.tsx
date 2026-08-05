"use client";

import { useState } from "react";
import { ChartCard, ToggleGroup } from "@/components/charts";
import type { LtvRow, TeacherLtvV2 } from "@/lib/teacherLtvV2";

type View = "profesora" | "mes";

function fmtEur(v: number) {
  return Math.round(v).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}
function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function BarList({ items }: { items: LtvRow[] }) {
  const max = Math.max(...items.map((i) => i.avgLtv), 1);
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.key} className="flex items-center gap-2.5">
          <span className="w-24 shrink-0 text-xs text-navy/70 truncate" title={it.label}>{it.label}</span>
          <div className="flex-1 h-4 rounded bg-navy/[0.05] overflow-hidden">
            <div className="h-full rounded bg-primary" style={{ width: `${(it.avgLtv / max) * 100}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right text-xs tabular-nums text-navy">
            {fmtEur(it.avgLtv)} <span className="text-navy/40">· {it.firstTimers}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// LTV (gasto histórico en Stripe) de quien tuvo su primera clase con cada profesora, o según su
// mes de entrada - complementa a "Conversión por profesora" (que da la tasa) con el valor
// económico real detrás de esa tasa. Ver [[project-profesoras-v2]].
export default function LtvNuevosAlumnos({ data }: { data: TeacherLtvV2 | null }) {
  const [view, setView] = useState<View>("profesora");

  if (!data || !data.hasData) {
    return (
      <ChartCard
        title="LTV de alumnos nuevos"
        subtitle="Gasto histórico en Stripe de quien tuvo su primera clase, por profesora o por mes de entrada"
      >
        <p className="text-sm text-navy/45">
          Aún no hay asistencia capturada. Aplica la migración 027 y ejecuta el backfill
          (scripts/backfill-attendance-v2.mjs) para calcular el LTV de alumnos nuevos.
        </p>
      </ChartCard>
    );
  }

  const items = view === "profesora" ? data.byTeacher : data.byEntryMonth;

  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          LTV de alumnos nuevos
          <ToggleGroup
            value={view}
            onChange={(v) => setView(v as View)}
            options={[
              { value: "profesora", label: "Por profesora" },
              { value: "mes", label: "Por mes de entrada" },
            ]}
          />
        </span>
      }
      subtitle="Gasto histórico en Stripe (de por vida) de quien tuvo su primera clase asistida en cada grupo - no solo si convirtió, sino cuánto ha dejado en total."
      dataSource={`De cada persona se toma su PRIMERA clase asistida (checkedIn, Momence v2) y quién se la dio o en qué mes fue. LTV = gasto histórico total en Stripe de esa persona ÷ nº de personas del grupo (incluye a quien no volvió a pagar, cuenta como 0). Cruce por email al ${pct(data.matchedRate)} - por debajo de eso el LTV es conservador (subestima). Métrica de por vida, no del período del filtro.`}
      sources={["momence", "stripe"]}
      kpiItems={[
        { label: "Alumnos nuevos", value: String(data.totalFirstTimers), tooltip: "Personas distintas con una primera clase asistida registrada." },
        { label: "LTV medio general", value: fmtEur(data.overallAvgLtv), valueClassName: "text-primary", tooltip: "Gasto histórico medio en Stripe por alumno nuevo, sea cual sea su profesora o mes de entrada." },
      ]}
    >
      {items.length === 0 ? (
        <p className="text-sm text-navy/45 text-center py-6">Sin datos suficientes</p>
      ) : (
        <BarList items={items} />
      )}
    </ChartCard>
  );
}
