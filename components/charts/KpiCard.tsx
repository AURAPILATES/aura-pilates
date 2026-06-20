import ChartCard, { type ChartCardProps } from "./ChartCard";

export type KpiCardProps = Omit<ChartCardProps, "toolbar" | "children" | "chartDescription">;

/** Variante de ChartCard sin zona de gráfico ni toolbar — solo header + KPI(s) + insight IA + fuente. */
export default function KpiCard(props: KpiCardProps) {
  return <ChartCard {...props} />;
}
