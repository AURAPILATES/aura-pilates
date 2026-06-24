import { fmt } from "@/lib/analytics";
import { ChartCard, RunwayDots, type RunwayTone } from "@/components/charts";

type Props = {
  currentBalance: number | null;
  balanceDate: string | null;
  runwayMonths: number | null;
  avgMonthlyBurn: number;
  completeBurnMonthsCount: number;
  resultadoMes: number;
  breakEvenGap: number;
  avgMonthlyRevenue: number;
  clientesNecesarios: number | null;
  curMonthLabel: string;
};

function runwayTone(r: number | null): RunwayTone {
  if (r === null) return "success";
  if (r < 3) return "danger";
  if (r < 6) return "warning";
  return "success";
}

function runwayClass(r: number | null) {
  if (r === null) return "text-navy/50";
  if (r < 3) return "text-danger";
  if (r < 6) return "text-warning";
  return "text-success";
}

export default function ResumenFinanzas(props: Props) {
  const {
    currentBalance, balanceDate, runwayMonths, avgMonthlyBurn,
    completeBurnMonthsCount, resultadoMes, breakEvenGap,
    avgMonthlyRevenue, clientesNecesarios, curMonthLabel,
  } = props;

  return (
    <ChartCard
      title="Resumen financiero"
      subtitle={`Snapshot de ${curMonthLabel.toLowerCase()}: caja, resultado y cobertura de gastos`}
      kpiItems={[
        {
          label: "Saldo en cuenta",
          value: currentBalance !== null ? fmt(currentBalance) : "—",
          valueClassName: currentBalance === null ? "text-navy/50" : undefined,
          helper: balanceDate ? `Últ. mov. ${balanceDate.split("-").reverse().join("/")}` : undefined,
        },
        {
          label: "Meses de caja",
          value: runwayMonths !== null ? `${runwayMonths.toFixed(1)} m` : "—",
          valueClassName: runwayClass(runwayMonths),
          helper: runwayMonths !== null ? (
            <>
              <RunwayDots segments={12} value={runwayMonths} tone={runwayTone(runwayMonths)} className="mb-1" />
              Coste fijo {fmt(avgMonthlyBurn)}/mes · media {completeBurnMonthsCount} m
            </>
          ) : undefined,
        },
        {
          label: `Resultado ${curMonthLabel}`,
          value: `${resultadoMes >= 0 ? "+" : "−"}${fmt(Math.abs(resultadoMes))}`,
          valueClassName: resultadoMes >= 0 ? "text-success" : "text-danger",
          helper: "ingresos − gastos",
        },
        {
          label: "¿Cubrimos gastos?",
          value: avgMonthlyRevenue <= 0
            ? "Sin ventas"
            : breakEvenGap <= 0 ? "Sí" : `−${fmt(breakEvenGap)}/mes`,
          valueClassName: avgMonthlyRevenue <= 0
            ? "text-navy/50"
            : breakEvenGap <= 0 ? "text-success" : "text-danger",
          helper: avgMonthlyRevenue > 0 ? (
            breakEvenGap <= 0
              ? `+${fmt(Math.abs(breakEvenGap))}/mes margen`
              : clientesNecesarios
                ? `≈ ${clientesNecesarios} clientes más para cubrir costes fijos`
                : "para cubrir los costes fijos"
          ) : undefined,
        },
      ]}
    />
  );
}
