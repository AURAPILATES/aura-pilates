"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChartCard, ToggleGroup, type MultiKpiItem } from "@/components/charts";
import GastosResumenGeneral, { type GroupTotal, fmtAmount } from "../GastosResumenGeneral";
import { type Period } from "./evolucionIngresosUtils";

const EvolucionGastosBody = dynamic(() => import("./EvolucionGastosBody"), {
  ssr: false,
  loading: () => <div className="h-[280px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

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
  const [period, setPeriod] = useState<Period>("mes");

  const kpiItems: MultiKpiItem[] = [{ label: "Total gastos", value: fmtAmount(totalExpCat) }];

  return (
    <ChartCard
      title="Desglose de gastos: visión general"
      subtitle="Personal, gasto operativo (OpEx) e inversión (CapEx), sin mezclar partidas"
      dateRange={rangeLabel ?? undefined}
      kpiItems={kpiItems}
      toolbar={
        <div className="flex justify-end w-full">
          <ToggleGroup
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
          />
        </div>
      }
      dataSource="Exportación bancaria CaixaBank · excluye aportaciones de socios y préstamo"
      sources={["excel"]}
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 min-w-0">
          <EvolucionGastosBody groups={groups} period={period} />
        </div>
        <div className="lg:col-span-1 min-w-0">
          <p className="text-xs font-medium text-navy/55 mb-2.5">Resumen</p>
          <GastosResumenGeneral groups={groups} totalExpCat={totalExpCat} />
        </div>
      </div>
    </ChartCard>
  );
}
