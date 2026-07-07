"use client";

import type { ReactNode } from "react";
import { type Tab, useAnaliticaTab } from "./AnaliticaTabContext";

type Props = Record<Tab, ReactNode>;

export default function AnaliticaTabs({ resumen, ingresosGastos, clientes, ocupacion }: Props) {
  const { tab } = useAnaliticaTab();
  const content: Props = { resumen, ingresosGastos, clientes, ocupacion };
  return <>{content[tab]}</>;
}
