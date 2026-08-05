"use client";

import { useState } from "react";
import ChartCard from "@/components/charts/ChartCard";
import Drawer from "@/app/components/Drawer";
import type { TeacherStat, TeacherStatsV2 } from "@/lib/teacherStatsV2";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/Madrid" });
}
function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
}

// Mismo criterio de color que el mapa de calor: verde ≥75%, ámbar ≥50%, rojo por debajo.
function occTone(v: number) {
  if (v >= 0.75) return "bg-success";
  if (v >= 0.5) return "bg-warning";
  return "bg-danger";
}

const DATA_SOURCE =
  "Clases regulares (tipo fitness) ya impartidas en el período, capturadas de Momence (API v2). " +
  "Ocupación reservada = reservas ÷ plazas; ocupación real = asistentes (checkedIn) ÷ plazas; " +
  "no-show = de quien reservó, cuántos no aparecieron.";

// Clases impartidas, ocupación (reservada vs real) y no-show por profesora. Complementa el
// mapa de calor (día × hora): la ocupación depende mucho de la franja, aquí se ve por persona.
export default function RendimientoProfesoras({
  data,
  dateRange,
}: {
  data: TeacherStatsV2 | null;
  dateRange: string;
}) {
  const [selected, setSelected] = useState<TeacherStat | null>(null);

  if (!data || !data.hasData || data.rows.length === 0) {
    return (
      <ChartCard
        title="Rendimiento por profesora"
        subtitle="Clases impartidas, ocupación real y no-show por profesora"
        dateRange={dateRange}
        dataSource={DATA_SOURCE}
        sources={["momence"]}
      >
        <p className="text-sm text-navy/45">
          Aún no hay asistencia capturada para este período. Aplica la migración 027 y ejecuta el
          backfill (scripts/backfill-attendance-v2.mjs); a partir de ahí el cron diario la mantiene.
        </p>
      </ChartCard>
    );
  }

  return (
    <>
    <ChartCard
      title="Rendimiento por profesora"
      subtitle="Clases impartidas, ocupación real y no-show. La ocupación varía mucho según día y hora — ver mapa de calor. Toca una fila para ver el detalle por clase."
      dateRange={dateRange}
      dataSource={DATA_SOURCE}
      sources={["momence"]}
      kpiItems={[
        {
          label: "Profesoras",
          value: String(data.rows.length),
          helper: `${data.totalClasses} clases`,
        },
        {
          label: "Ocupación real",
          value: pct(data.occupancyReal),
          valueClassName: data.occupancyReal >= 0.75 ? "text-success" : data.occupancyReal < 0.5 ? "text-danger" : "text-warning",
          helper: `reservada ${pct(data.occupancyReserved)}`,
          tooltip: "Asistentes reales (checkedIn) ÷ plazas totales. 'Reservada' es quién reservó (mayor), la diferencia son los no-shows.",
        },
        {
          label: "No-show medio",
          value: pct(data.noShowRate),
          valueClassName: data.noShowRate >= 0.2 ? "text-danger" : data.noShowRate >= 0.1 ? "text-warning" : "text-success",
          tooltip: "De todas las reservas, qué porcentaje no llegó a aparecer en clase (reservó y no hizo check-in ni canceló).",
        },
      ]}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-navy/[0.07] text-navy/50 text-xs">
              <th className="text-left font-medium py-2 pr-3">Profesora</th>
              <th className="text-right font-medium py-2 pr-3">Clases</th>
              <th className="text-right font-medium py-2 pr-3">Reservada</th>
              <th className="text-right font-medium py-2 pr-3">No-show</th>
              <th className="text-right font-medium py-2 pl-6">Ocupación real</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr
                key={r.teacher}
                onClick={() => setSelected(r)}
                className="border-b border-navy/[0.04] cursor-pointer hover:bg-navy/[0.02] transition-colors"
              >
                <td className="py-2.5 pr-3 text-navy font-medium hover:underline">{r.teacher}</td>
                <td className="py-2.5 pr-3 text-right text-navy tabular-nums">{r.classes}</td>
                <td className="py-2.5 pr-3 text-right text-navy/55 tabular-nums">{pct(r.occupancyReserved)}</td>
                <td className={`py-2.5 pr-3 text-right tabular-nums ${r.noShowRate >= 0.2 ? "text-danger" : "text-navy/55"}`}>
                  {pct(r.noShowRate)}
                </td>
                <td className="py-2.5 pl-6">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-24 h-2 rounded-full bg-navy/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${occTone(r.occupancyReal)}`}
                        style={{ width: `${Math.round(r.occupancyReal * 100)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-navy font-medium w-9 text-right">{pct(r.occupancyReal)}</span>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="font-semibold text-navy">
              <td className="py-2.5 pr-3">Total</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{data.totalClasses}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-navy/55">{pct(data.occupancyReserved)}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-navy/55">{pct(data.noShowRate)}</td>
              <td className="py-2.5 pl-6 text-right tabular-nums">{pct(data.occupancyReal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ChartCard>

    {selected && (
      <Drawer
        title={selected.teacher}
        subtitle={`${selected.classes} clases · ${pct(selected.occupancyReal)} ocupación real`}
        onClose={() => setSelected(null)}
      >
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/[0.07] text-navy/50 text-xs">
                <th className="text-left font-medium py-2 pr-2">Clase</th>
                <th className="text-right font-medium py-2 pr-2">Aforo</th>
                <th className="text-right font-medium py-2">Asistió</th>
              </tr>
            </thead>
            <tbody>
              {selected.sessions.map((s, i) => {
                const occ = s.capacity > 0 ? s.checkedIn / s.capacity : 0;
                const noShow = s.booked > s.checkedIn;
                return (
                  <tr key={i} className="border-b border-navy/[0.04] last:border-0">
                    <td className="py-2 pr-2 text-navy/80 whitespace-nowrap">{fmtDate(s.startsAt)} · {fmtHour(s.startsAt)}</td>
                    <td className="py-2 pr-2 text-right text-navy/55 tabular-nums">{s.capacity}</td>
                    <td className={`py-2 text-right tabular-nums font-medium ${occ >= 0.75 ? "text-success" : occ < 0.5 ? "text-danger" : "text-warning"}`}>
                      {s.checkedIn}/{s.capacity}
                      {noShow && <span className="text-danger/70 font-normal"> ({s.booked - s.checkedIn} no-show)</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Drawer>
    )}
    </>
  );
}
