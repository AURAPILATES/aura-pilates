"use client";

import { useMemo, useState } from "react";
import type { StripePayment } from "@/lib/stripePayments";
import type { UrbanClientRow } from "@/lib/clientActivityV2";
import type { CustomerRow } from "./ClientesTable";
import { PRODUCT_FILTERS } from "./ClientesMatrizCompras";
import { periodKey, periodLabel, type Period } from "@/app/analitica/instances/evolucionIngresosUtils";
import { familyEmailSet, otroOrFamiliar } from "@/lib/clientFamily";
import ClientesResumenAlumnosV2 from "./ClientesResumenAlumnosV2";

// Igual set de filas que tenía "Por producto": los 7 productos con cobro por Stripe + "Familiar"
// (pagos de alumnos marcados como Familiar que no casan con ningún precio, p.ej. un descuento) +
// "Otro" (el resto de pagos sin producto conocido - sin esto la fila Total no cuadraría con el
// ingreso real de Stripe) + "Urban" (asistencia, no pago individual).
const PRODUCT_ROWS = [...PRODUCT_FILTERS, "Familiar", "Otro", "Urban"];

type Props = {
  payments: StripePayment[];
  urbanClients: UrbanClientRow[];
  customers: CustomerRow[];
};

export type PeriodCell = { count: number; amount: number };
export type SummaryRow = {
  product: string;
  byPeriod: Record<string, PeriodCell>;
  totalCount: number;
  totalAmount: number;
};

/** Une clientes distintos (dedup) y suma importe de varios productos/meses de golpe - se usa
 * tanto para una fila de producto (un único producto, todos los meses de un período) como para
 * la fila Total (todos los productos, todos los meses de un período): la cuenta de personas
 * nunca es la suma de sub-cuentas, siempre una unión de sets, para no contar dos veces a quien
 * repite mes o producto. */
function aggregate(
  byProductMonth: Map<string, Map<string, { customers: Set<string>; amount: number }>>,
  products: string[],
  months: string[],
): PeriodCell {
  const customers = new Set<string>();
  let amount = 0;
  for (const product of products) {
    const byMonth = byProductMonth.get(product);
    if (!byMonth) continue;
    for (const m of months) {
      const cell = byMonth.get(m);
      if (!cell) continue;
      for (const c of cell.customers) customers.add(c);
      amount += cell.amount;
    }
  }
  return { count: customers.size, amount };
}

export default function ClientesResumenAlumnos({ payments, urbanClients, customers }: Props) {
  const [period, setPeriod] = useState<Period>("mes");
  const familyEmails = useMemo(() => familyEmailSet(customers), [customers]);

  const months = useMemo(() => {
    const now = new Date();
    const start = new Date(2026, 1, 1); // Feb 2026 - apertura
    const months: string[] = [];
    const cur = new Date(start);
    while (cur <= now) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }, []);

  const byProductMonth = useMemo(() => {
    const map = new Map<string, Map<string, { customers: Set<string>; amount: number }>>();
    function bucket(product: string, month: string) {
      if (!map.has(product)) map.set(product, new Map());
      const byMonth = map.get(product)!;
      if (!byMonth.has(month)) byMonth.set(month, { customers: new Set(), amount: 0 });
      return byMonth.get(month)!;
    }
    for (const p of payments) {
      const product = PRODUCT_FILTERS.includes(p.inferredProduct)
        ? p.inferredProduct
        : otroOrFamiliar(p.customerEmail, familyEmails);
      const cell = bucket(product, p.date.slice(0, 7));
      cell.amount += p.amount;
      if (p.customerId) cell.customers.add(p.customerId);
    }
    for (const r of urbanClients) {
      for (const [month, act] of Object.entries(r.byMonth)) {
        if (!act.classes) continue;
        const cell = bucket("Urban", month);
        cell.amount += act.estimated;
        cell.customers.add(String(r.memberId));
      }
    }
    return map;
  }, [payments, urbanClients, familyEmails]);

  const { periods, rows, totalRow } = useMemo(() => {
    const monthsByPeriod = new Map<string, string[]>();
    for (const m of months) {
      const k = periodKey(m, period);
      if (!monthsByPeriod.has(k)) monthsByPeriod.set(k, []);
      monthsByPeriod.get(k)!.push(m);
    }
    const periods = [...monthsByPeriod.keys()];

    const rows: SummaryRow[] = PRODUCT_ROWS.map((product) => {
      const byPeriod: Record<string, PeriodCell> = {};
      for (const [k, ms] of monthsByPeriod) byPeriod[k] = aggregate(byProductMonth, [product], ms);
      const totals = aggregate(byProductMonth, [product], months);
      return { product, byPeriod, totalCount: totals.count, totalAmount: totals.amount };
    });

    const totalByPeriod: Record<string, PeriodCell> = {};
    for (const [k, ms] of monthsByPeriod) totalByPeriod[k] = aggregate(byProductMonth, PRODUCT_ROWS, ms);
    const grand = aggregate(byProductMonth, PRODUCT_ROWS, months);

    return { periods, rows, totalRow: { byPeriod: totalByPeriod, totalCount: grand.count, totalAmount: grand.amount } };
  }, [byProductMonth, months, period]);

  function downloadCsv() {
    const header = ["Producto", ...periods.map((k) => `${periodLabel(k, period)} (alumnos)`), ...periods.map((k) => `${periodLabel(k, period)} (€)`), "Total alumnos", "Total €"];
    const totalLine = [
      "Total",
      ...periods.map((k) => String(totalRow.byPeriod[k]?.count ?? 0)),
      ...periods.map((k) => (totalRow.byPeriod[k]?.amount ?? 0).toFixed(2)),
      String(totalRow.totalCount),
      totalRow.totalAmount.toFixed(2),
    ];
    const rowLines = rows.map((r) => [
      r.product,
      ...periods.map((k) => String(r.byPeriod[k]?.count ?? 0)),
      ...periods.map((k) => (r.byPeriod[k]?.amount ?? 0).toFixed(2)),
      String(r.totalCount),
      r.totalAmount.toFixed(2),
    ]);
    const csv = [header, totalLine, ...rowLines]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resumen-alumnos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows.every((r) => r.totalCount === 0)) return null;

  return (
    <ClientesResumenAlumnosV2
      period={period}
      onPeriodChange={setPeriod}
      periods={periods}
      periodLabel={(k) => periodLabel(k, period)}
      rows={rows}
      totalRow={totalRow}
      onExportCsv={downloadCsv}
    />
  );
}
