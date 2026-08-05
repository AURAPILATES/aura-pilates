"use client";

import { useState } from "react";
import ChartCard from "@/components/charts/ChartCard";
import Drawer from "@/app/components/Drawer";
import type { TeacherConversionRow, TeacherConversionV2 } from "@/lib/teacherConversionV2";

const pct = (v: number) => `${Math.round(v * 100)}%`;

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function rateTone(v: number) {
  if (v >= 0.5) return "bg-success";
  if (v >= 0.3) return "bg-warning";
  return "bg-danger";
}

const DATA_SOURCE =
  "De cada persona se toma su PRIMERA clase asistida (checkedIn, Momence v2) y quién se la dio. " +
  "'Convirtió' = pagó luego una suscripción o un pack (Stripe), Benvinguda aparte. Métrica de por vida, " +
  "no del período del filtro. Cruce por email: los que no cruzan solo pueden contar como 'no convirtió'.";

// Conversión por profesora: de quien tuvo su 1ª clase con ella, cuántos volvieron a pagar
// (sub o pack). Cruza asistencia real de Momence con las ventas de Stripe.
export default function ConversionProfesora({ data }: { data: TeacherConversionV2 | null }) {
  const [selected, setSelected] = useState<TeacherConversionRow | null>(null);

  if (!data || !data.hasData || data.rows.length === 0) {
    return (
      <ChartCard
        title="Conversión por profesora"
        subtitle="De quien tuvo su 1ª clase con cada profesora, cuántos volvieron a pagar (sub o pack)"
        dataSource={DATA_SOURCE}
        sources={["momence", "stripe"]}
      >
        <p className="text-sm text-navy/45">
          Aún no hay asistencia capturada. Aplica la migración 027 y ejecuta el backfill
          (scripts/backfill-attendance-v2.mjs) para calcular la conversión por profesora.
        </p>
      </ChartCard>
    );
  }

  return (
    <>
    <ChartCard
      title="Conversión por profesora"
      subtitle="De quien tuvo su 1ª clase con cada profesora, cuántos volvieron a pagar (sub o pack). Métrica de por vida. Toca una fila para ver el detalle."
      dataSource={DATA_SOURCE}
      sources={["momence", "stripe"]}
      kpiItems={[
        {
          label: "1as clases",
          value: String(data.totalFirstTimers),
          helper: "personas estrenadas",
          tooltip: "Personas distintas cuya primera clase asistida quedó registrada, atribuida a quien se la dio.",
        },
        {
          label: "Volvieron a pagar",
          value: String(data.totalConverted),
          tooltip: "De esas personas, cuántas pagaron después una suscripción o un pack (Benvinguda aparte).",
        },
        {
          label: "Conversión media",
          value: pct(data.rate),
          valueClassName: data.rate >= 0.5 ? "text-success" : data.rate < 0.3 ? "text-danger" : "text-warning",
          tooltip: `Convirtieron ÷ 1as clases. Cruce por email al ${pct(data.matchedRate)} — por debajo de eso la tasa es conservadora.`,
        },
      ]}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-navy/[0.07] text-navy/50 text-xs">
              <th className="text-left font-medium py-2 pr-3">Profesora</th>
              <th className="text-right font-medium py-2 pr-3">1as clases</th>
              <th className="text-right font-medium py-2 pr-3">Volvieron</th>
              <th className="text-right font-medium py-2 pl-6">Conversión</th>
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
                <td className="py-2.5 pr-3 text-right text-navy tabular-nums">{r.firstTimers}</td>
                <td className="py-2.5 pr-3 text-right text-navy/70 tabular-nums">{r.converted}</td>
                <td className="py-2.5 pl-6">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-24 h-2 rounded-full bg-navy/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${rateTone(r.rate)}`}
                        style={{ width: `${Math.round(r.rate * 100)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-navy font-medium w-9 text-right">{pct(r.rate)}</span>
                  </div>
                </td>
              </tr>
            ))}
            <tr className="font-semibold text-navy">
              <td className="py-2.5 pr-3">Total</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{data.totalFirstTimers}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-navy/70">{data.totalConverted}</td>
              <td className="py-2.5 pl-6 text-right tabular-nums">{pct(data.rate)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ChartCard>

    {selected && (
      <Drawer
        title={selected.teacher}
        subtitle={`${selected.firstTimers} primeras clases · ${selected.converted} convirtieron`}
        onClose={() => setSelected(null)}
      >
        <div className="px-6 py-4 space-y-2">
          {selected.people.map((p) => (
            <div key={p.memberId} className="flex items-center justify-between gap-3 py-2 border-b border-navy/[0.04] last:border-0">
              <div className="min-w-0">
                <p className="text-sm text-navy font-medium truncate">{p.name ?? p.email ?? "Sin nombre"}</p>
                <p className="text-xs text-navy/45 truncate">{p.email ?? "sin email"} · 1ª clase {fmtDate(p.date)}</p>
              </div>
              <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${p.converted ? "text-success bg-success/10" : "text-navy/40 bg-navy/[0.04]"}`}>
                {p.converted ? "Convirtió" : "No convirtió"}
              </span>
            </div>
          ))}
        </div>
      </Drawer>
    )}
    </>
  );
}
