"use client";

import { useState } from "react";
import { ToggleGroup } from "@/components/charts";
import RendimientoProfesoras from "./RendimientoProfesoras";
import ConversionProfesora from "./ConversionProfesora";
import LtvNuevosAlumnos from "./LtvNuevosAlumnos";
import PrimeraClaseSuscriptores from "./PrimeraClaseSuscriptores";
import type { TeacherStatsV2 } from "@/lib/teacherStatsV2";
import type { TeacherConversionV2 } from "@/lib/teacherConversionV2";
import type { TeacherLtvV2 } from "@/lib/teacherLtvV2";
import type { SubscriberFirstClassV2 } from "@/lib/subscriberFirstClassV2";

type View = "rendimiento" | "conversion" | "ltv" | "primera";

// Las 4 vistas "por profesora" (rendimiento, conversión, LTV, primera clase) respondían antes a
// la pregunta "¿cómo va Fulanita?" repartida en 4 ChartCard completas seguidas - había que
// escanear toda la sección para reconstruirla. Un selector compartido las agrupa en un solo
// sitio, mostrando una vista completa a la vez en vez de cuatro apiladas.
export default function ProfesoraInsights({
  dateRange,
  teacherStats,
  teacherConversion,
  teacherLtv,
  subscriberFirstClass,
}: {
  dateRange: string;
  teacherStats: TeacherStatsV2 | null;
  teacherConversion: TeacherConversionV2 | null;
  teacherLtv: TeacherLtvV2 | null;
  subscriberFirstClass: SubscriberFirstClassV2 | null;
}) {
  const [view, setView] = useState<View>("rendimiento");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-navy/45 shrink-0">Por profesora</span>
        <ToggleGroup
          value={view}
          onChange={(v) => setView(v as View)}
          options={[
            { value: "rendimiento", label: "Rendimiento" },
            { value: "conversion", label: "Conversión" },
            { value: "ltv", label: "LTV" },
            { value: "primera", label: "Primera clase" },
          ]}
        />
      </div>
      {view === "rendimiento" && <RendimientoProfesoras data={teacherStats} dateRange={dateRange} />}
      {view === "conversion" && <ConversionProfesora data={teacherConversion} />}
      {view === "ltv" && <LtvNuevosAlumnos data={teacherLtv} />}
      {view === "primera" && <PrimeraClaseSuscriptores data={subscriberFirstClass} />}
    </div>
  );
}
