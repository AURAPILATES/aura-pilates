"use client";

import { useState } from "react";
import type { RetentionCohortRow } from "@/lib/subscriptionCohort";
import { ChartCard, CohortTable } from "@/components/charts";
import Drawer from "@/app/components/Drawer";

const COLUMNS = ["M+1", "M+2", "M+3", "M+4"];

type CellSelection = { rowIndex: number; colIndex: number | null }; // null = "Entrada"

export default function RetencionCohorte({ cohorts }: { cohorts: RetentionCohortRow[] }) {
  const [selected, setSelected] = useState<CellSelection | null>(null);

  if (cohorts.length === 0) {
    return <ChartCard title="Retención por cohorte" subtitle="Sin datos suficientes" />;
  }

  const m1Values = cohorts.map((c) => c.values[0]).filter((v): v is number => v !== null);
  const m1Avg = m1Values.length > 0 ? Math.round(m1Values.reduce((s, v) => s + v, 0) / m1Values.length) : null;
  const bestIdx = m1Values.length > 0 ? cohorts.findIndex((c) => c.values[0] === Math.max(...m1Values)) : -1;
  const best = bestIdx >= 0 ? cohorts[bestIdx] : null;

  const selectedCohort = selected ? cohorts[selected.rowIndex] : null;
  const selectedColLabel = selected && selected.colIndex !== null ? COLUMNS[selected.colIndex] : null;

  return (
    <>
      <ChartCard
        title="Retención por cohorte"
        subtitle="% del grupo inicial que volvió a pagar cada mes siguiente"
        dateRange={`${cohorts[0].label} – ${cohorts[cohorts.length - 1].label}`}
        kpiItems={[
          {
            label: "Retención M+1 media",
            value: m1Avg !== null ? `${m1Avg}%` : "-",
            valueClassName: "text-primary",
            tooltip: "De cada cohorte (mes de primer pago), qué % volvió a pagar al mes siguiente. No hace falta llegar al 100%: algunas bajas al primer mes son normales (packs que no eran para renovar, prueba puntual) - lo relevante es la tendencia entre cohortes, no el valor absoluto de una sola.",
          },
          {
            label: "Mejor cohorte M+1",
            value: best ? <>{best.values[0]}% <span className="text-xs text-navy/50 font-normal">{best.label.split(" ")[0].toLowerCase()}</span></> : "-",
            valueClassName: "text-success",
            tooltip: "La cohorte de entrada con mayor % de retención al mes siguiente.",
          },
          { label: "Cohortes activas", value: String(cohorts.length), tooltip: "Meses de entrada con al menos una cohorte formada, dentro del rango mostrado." },
        ]}
        dataSource="Cohorte = mes del primer pago de suscripción en Stripe (clientes internos - no incluye Urban Sports Club, que no paga por Stripe). 'Volvió a pagar' = tuvo otro pago de suscripción en Stripe en ese mes siguiente, siga o no siendo la misma suscripción. Toca una celda para ver quién forma la cohorte."
        sources={["stripe"]}
        lastUpdated="ahora"
      >
        <CohortTable
          columns={COLUMNS}
          rows={cohorts.map((c) => ({ label: c.label, n: c.n, values: c.values }))}
          onCellClick={(rowIndex, colIndex) => setSelected({ rowIndex, colIndex })}
          onEntradaClick={(rowIndex) => setSelected({ rowIndex, colIndex: null })}
        />
      </ChartCard>

      {selectedCohort && (
        <Drawer
          title={selectedCohort.label}
          subtitle={selectedColLabel ? `Retención en ${selectedColLabel}` : `Cohorte de entrada · ${selectedCohort.n} clientes`}
          onClose={() => setSelected(null)}
        >
          <div className="px-6 py-4 space-y-2">
            {selectedCohort.customers.map((c, i) => {
              const retained = selected!.colIndex !== null ? selectedCohort.retainedByCustomer[i]?.[selected!.colIndex] : null;
              return (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2 border-b border-navy/[0.04] last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-navy font-medium truncate">{c.name ?? c.email ?? "Sin nombre"}</p>
                    {c.email && <p className="text-xs text-navy/45 truncate">{c.email}</p>}
                  </div>
                  {retained !== null && (
                    <span
                      className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                        retained ? "text-success bg-success/10" : "text-navy/40 bg-navy/[0.04]"
                      }`}
                    >
                      {retained ? "Siguió pagando" : "No renovó"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Drawer>
      )}
    </>
  );
}
