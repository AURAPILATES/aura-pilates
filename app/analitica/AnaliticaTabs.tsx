"use client";

import type { ReactNode } from "react";
import { type Tab, useAnaliticaTab } from "./AnaliticaTabContext";

type Props = Record<Tab, ReactNode>;

export default function AnaliticaTabs({ caja, gastos, ingresos, clientes, fiscal, ocupacion }: Props) {
  const { tab } = useAnaliticaTab();
  const content: Props = { caja, gastos, ingresos, clientes, fiscal, ocupacion };
  return <>{content[tab]}</>;
}
