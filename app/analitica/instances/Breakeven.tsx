"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { BreakevenPoint } from "@/lib/breakeven";
import { ChartCard, ToggleGroup, Legend } from "@/components/charts";

const BreakevenBody = dynamic(() => import("./BreakevenBody"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-lg bg-navy/[0.04] animate-pulse" />,
});

function fmtEur(v: number) {
  const sign = v < 0 ? "−" : "";
  return sign + Math.abs(v).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €";
}

export default function Breakeven({ points, lastUpdated }: { points: BreakevenPoint[]; lastUpdated?: string | null }) {
  const [view, setView] = useState<"bruto" | "neto">("bruto");

  if (points.length === 0) {
    return <ChartCard title="Breakeven desde el inicio" subtitle="Sin datos suficientes" />;
  }

  const last = points[points.length - 1];
  const breakevenIdx = points.findIndex((p) => p.cumNet >= 0);
  const isBreakeven = breakevenIdx !== -1;

  return (
    <ChartCard
      title="Breakeven desde el inicio"
      dateRange="Desde apertura"
      subtitle={
        isBreakeven ? (
          <span className="text-success font-medium">
            Breakeven alcanzado en {points[breakevenIdx].label} · resultado neto acumulado: {fmtEur(last.cumNet)}
          </span>
        ) : (
          <span className="text-navy/55">
            Aún no alcanzado · faltan {fmtEur(Math.abs(last.cumNet))} para cubrir el acumulado
          </span>
        )
      }
      toolbar={
        <>
          {view === "bruto" && (
            <Legend items={[{ label: "Ingresos acumulados", color: "#43884d" }, { label: "Gastos acumulados", color: "#f44854" }]} />
          )}
          <ToggleGroup
            value={view}
            onChange={(v) => setView(v as "bruto" | "neto")}
            options={[{ value: "bruto", label: "Bruto" }, { value: "neto", label: "Neto" }]}
            className="ml-auto"
          />
        </>
      }
      dataSource="Ingresos: Stripe + Urban Sports Club (Momence), en vivo · Gastos: exportación bancaria CaixaBank, incluye la inversión inicial — la fecha de actualización de esta tarjeta es la del banco, el lado que limita lo al día que está el resultado"
      sources={["stripe", "momence", "excel"]}
      lastUpdated={lastUpdated}
    >
      <BreakevenBody points={points} view={view} />
    </ChartCard>
  );
}
