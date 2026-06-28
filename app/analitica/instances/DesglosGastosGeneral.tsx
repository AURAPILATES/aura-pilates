"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChartCard, ToggleGroup } from "@/components/charts";
import GastosResumenGeneral, { type GroupTotal, fmtAmount } from "../GastosResumenGeneral";
import { type Period } from "./evolucionIngresosUtils";

const EvolucionGastosBody = dynamic(() => import("./EvolucionGastosBody"), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

type View = "resumen" | "evolucion";

const PERIODS: { key: Period; label: string }[] = [
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "año", label: "Año" },
];

export default function DesglosGastosGeneral({
  groups,
  totalExpCat,
  rangeLabel,
}: {
  groups: GroupTotal[];
  totalExpCat: number;
  rangeLabel?: string | null;
}) {
  const [view, setView] = useState<View>("resumen");
  const [period, setPeriod] = useState<Period>("mes");

  return (
    <ChartCard
      title="Desglose de gastos: visión general"
      subtitle="Personal, gasto operativo (OpEx) e inversión (CapEx), sin mezclar partidas"
      dateRange={rangeLabel ?? undefined}
      toolbar={
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-navy/45 font-medium">Total gastos</span>
            <span className="text-base font-semibold text-navy tabular-nums">{fmtAmount(totalExpCat)}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ToggleGroup
              value={view}
              onChange={(v) => setView(v as View)}
              options={[
                { value: "resumen", label: "Resumen" },
                { value: "evolucion", label: "Evolución" },
              ]}
            />
            {view === "evolucion" && (
              <ToggleGroup
                value={period}
                onChange={(v) => setPeriod(v as Period)}
                options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
              />
            )}
          </div>
        </>
      }
      dataSource="Exportación bancaria CaixaBank · excluye aportaciones de socios y préstamo"
      sources={["excel"]}
    >
      {view === "resumen" ? (
        <GastosResumenGeneral groups={groups} totalExpCat={totalExpCat} />
      ) : (
        <EvolucionGastosBody groups={groups} period={period} />
      )}
    </ChartCard>
  );
}
