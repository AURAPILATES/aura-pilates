import ChartCard from "@/components/charts/ChartCard";
import type { TeacherConversionV2 } from "@/lib/teacherConversionV2";

const pct = (v: number) => `${Math.round(v * 100)}%`;

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
    <ChartCard
      title="Conversión por profesora"
      subtitle="De quien tuvo su 1ª clase con cada profesora, cuántos volvieron a pagar (sub o pack). Métrica de por vida."
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
              <tr key={r.teacher} className="border-b border-navy/[0.04]">
                <td className="py-2.5 pr-3 text-navy">{r.teacher}</td>
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
  );
}
