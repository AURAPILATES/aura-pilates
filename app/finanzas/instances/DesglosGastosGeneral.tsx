import { ChartCard } from "@/components/charts";
import GastosResumenGeneral, { type GroupTotal } from "../GastosResumenGeneral";

export default function DesglosGastosGeneral({
  groups,
  totalExpCat,
  rangeLabel,
}: {
  groups: GroupTotal[];
  totalExpCat: number;
  rangeLabel?: string | null;
}) {
  return (
    <ChartCard
      title="Desglose de gastos: visión general"
      subtitle="Personal, gasto operativo (OpEx) e inversión (CapEx), sin mezclar partidas"
      dateRange={rangeLabel ?? undefined}
      dataSource="Exportación bancaria CaixaBank · excluye aportaciones de socios y préstamo"
      sources={["excel"]}
    >
      <GastosResumenGeneral groups={groups} totalExpCat={totalExpCat} rangeLabel={rangeLabel} />
    </ChartCard>
  );
}
