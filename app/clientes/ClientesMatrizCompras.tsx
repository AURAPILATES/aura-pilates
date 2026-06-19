"use client";

import { useMemo } from "react";
import type { StripePayment } from "@/lib/stripePayments";
import type { CustomerRow } from "./ClientesTable";
import { fmt } from "@/lib/analytics";

const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS_ES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function productAbbr(product: string): string {
  if (product === "Bàsic")            return "Bàsic";
  if (product === "Plus")             return "Plus";
  if (product === "Pro")              return "Pro";
  if (product === "Pack 4 clases")    return "Pack 4";
  if (product === "Pack 8 clases")    return "Pack 8";
  if (product === "Pack Benvinguda")  return "Benvinguda";
  if (product === "Clase suelta")     return "Suelta";
  return "Otro";
}

function productColor(product: string): string {
  if (product === "Bàsic" || product === "Plus" || product === "Pro")
    return "bg-violet-50 text-violet-600";
  if (product === "Pack Benvinguda")
    return "bg-pink-50 text-pink-600";
  if (product === "Pack 4 clases" || product === "Pack 8 clases")
    return "bg-orange-50 text-orange-600";
  if (product === "Clase suelta")
    return "bg-yellow-50 text-yellow-600";
  return "bg-navy/[0.05] text-navy/50";
}

type Props = {
  customers: CustomerRow[];
  payments: StripePayment[];
};

export default function ClientesMatrizCompras({ customers, payments }: Props) {
  const { months, matrix } = useMemo(() => {
    const now = new Date();
    const start = new Date(2026, 1, 1); // Feb 2026 — apertura
    const months: string[] = [];
    const cur = new Date(start);
    while (cur <= now) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }

    const sorted = [...customers].sort((a, b) =>
      (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "", "es"),
    );

    const matrix = sorted.map((c) => {
      const byMonth: Record<string, Array<{ product: string; amount: number }>> = {};
      let totalPaid = 0;
      for (const p of payments) {
        if (!p.customerId || !c.stripeIds.includes(p.customerId)) continue;
        const m = p.date.slice(0, 7);
        if (!byMonth[m]) byMonth[m] = [];
        byMonth[m].push({ product: p.inferredProduct, amount: p.amount });
        totalPaid += p.amount;
      }
      return { customer: c, byMonth, totalPaid };
    });

    return { months, matrix };
  }, [customers, payments]);

  if (matrix.length === 0) return null;

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5 mb-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-navy">Compras por cliente y mes</h3>
        <p className="text-xs text-navy/45 mt-0.5">
          Todas las compras registradas · cada celda muestra el producto y el importe
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs" style={{ tableLayout: "auto", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr className="border-b border-navy/[0.06]">
              <th className="sticky left-0 bg-white text-left pb-2 pr-3 text-[11px] font-semibold text-navy/40 uppercase tracking-wider whitespace-nowrap z-10 min-w-[130px]">
                Cliente
              </th>
              <th className="sticky left-[130px] bg-white text-right pb-2 pr-4 text-[11px] font-semibold text-navy/40 uppercase tracking-wider whitespace-nowrap z-10 min-w-[72px]">
                Total
              </th>
              {months.map((m) => (
                <th key={m} className="text-center pb-2 px-1 text-[11px] font-semibold text-navy/40 uppercase tracking-wider whitespace-nowrap min-w-[76px]">
                  {monthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(({ customer, byMonth, totalPaid }) => (
              <tr key={customer.id} className="border-b border-navy/[0.04] last:border-0 hover:bg-navy/[0.015] transition-colors">
                <td className="sticky left-0 bg-white py-2 pr-3 font-medium text-navy whitespace-nowrap z-10 max-w-[130px] truncate" title={customer.name ?? customer.email ?? undefined}>
                  {customer.name ?? customer.email ?? "—"}
                </td>
                <td className="sticky left-[130px] bg-white py-2 pr-4 text-right whitespace-nowrap z-10">
                  <span className="text-[11px] font-semibold text-navy tabular-nums">{fmt(totalPaid)}</span>
                </td>
                {months.map((m) => {
                  const purchases = byMonth[m];
                  if (!purchases || purchases.length === 0) {
                    return <td key={m} className="py-1.5 px-1 text-center" />;
                  }
                  const products = [...new Map(purchases.map((p) => [p.product, p])).keys()];
                  const total = purchases.reduce((s, p) => s + p.amount, 0);
                  const colorCls = productColor(products[0]);
                  return (
                    <td key={m} className="py-1.5 px-1 text-center">
                      <div className={`rounded-lg px-1.5 py-1 flex flex-col items-center gap-0.5 ${colorCls} min-w-[68px]`}>
                        {products.map((prod) => (
                          <span key={prod} className="text-[10px] font-semibold leading-tight">
                            {productAbbr(prod)}
                          </span>
                        ))}
                        <span className="text-[9px] opacity-60 leading-tight font-medium">
                          {fmt(total)}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
