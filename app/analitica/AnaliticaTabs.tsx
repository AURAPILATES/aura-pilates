"use client";

import type { ReactNode } from "react";
import { type Tab, useAnaliticaTab } from "./AnaliticaTabContext";

type Props = Record<Tab, ReactNode>;

export default function AnaliticaTabs({ ingresosGastos, clientes }: Props) {
  const { tab } = useAnaliticaTab();
  const content: Props = { ingresosGastos, clientes };
  return <>{content[tab]}</>;
}
