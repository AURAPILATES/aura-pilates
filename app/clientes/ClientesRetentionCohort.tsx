"use client";

import { useMemo } from "react";
import type { StripePayment } from "@/lib/stripePayments";

const MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function cellStyle(val: number): React.CSSProperties {
  const opacity = 0.12 + val * 0.78;
  return { backgroundColor: `rgba(107, 126, 214, ${opacity})` };
}

export default function ClientesRetentionCohort({ payments }: { payments: StripePayment[] }) {
  const { rows, maxCols } = useMemo(() => {
    const monthsByCustomer = new Map<string, Set<string>>();
    for (const p of payments) {
      if (!p.customerId) continue;
      const m = p.date.slice(0, 7);
      const set = monthsByCustomer.get(p.customerId) ?? new Set<string>();
      set.add(m);
      monthsByCustomer.set(p.customerId, set);
    }

    const cohorts = new Map<string, string[]>();
    for (const [id, months] of monthsByCustomer) {
      const first = [...months].sort()[0];
      const list = cohorts.get(first) ?? [];
      list.push(id);
      cohorts.set(first, list);
    }

    const nowMonth = new Date().toISOString().slice(0, 7);

    const rows = [...cohorts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cohortMonth, ids]) => {
        const [cy, cm] = cohortMonth.split("-").map(Number);
        const [ny, nm] = nowMonth.split("-").map(Number);
        const maxOffset = Math.min((ny - cy) * 12 + (nm - cm), 11);

        const cols: (number | null)[] = [];
        for (let i = 0; i <= maxOffset; i++) {
          const target = addMonths(cohortMonth, i);
          if (target > nowMonth) { cols.push(null); continue; }
          const count = ids.filter(id => monthsByCustomer.get(id)?.has(target)).length;
          cols.push(count / ids.length);
        }

        return { label: monthLabel(cohortMonth), size: ids.length, cols };
      });

    const maxCols = Math.max(...rows.map(r => r.cols.length), 1);
    return { rows, maxCols };
  }, [payments]);

  if (rows.length === 0) return null;

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5 mb-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-navy">Retención por cohorte</h3>
        <p className="text-xs text-navy/45 mt-0.5">% de clientes que volvieron a pagar · por mes desde su primera compra</p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs" style={{ tableLayout: "auto" }}>
          <thead>
            <tr className="border-b border-navy/[0.06]">
              <th className="text-left pb-2 pr-5 text-[11px] font-semibold text-navy/40 uppercase tracking-wider whitespace-nowrap">Cohorte</th>
              <th className="text-right pb-2 px-3 text-[11px] font-semibold text-navy/40 uppercase tracking-wider">N</th>
              {Array.from({ length: maxCols }, (_, i) => (
                <th key={i} className="text-center pb-2 px-1 text-[11px] font-semibold text-navy/40 uppercase tracking-wider whitespace-nowrap min-w-[48px]">
                  M+{i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-navy/[0.04] last:border-0">
                <td className="py-1.5 pr-5 font-medium text-navy whitespace-nowrap">{row.label}</td>
                <td className="py-1.5 px-3 text-right text-navy/40 tabular-nums">{row.size}</td>
                {Array.from({ length: maxCols }, (_, i) => {
                  const val = row.cols[i] ?? null;
                  if (val === null) {
                    return <td key={i} className="py-1.5 px-1" />;
                  }
                  return (
                    <td key={i} className="py-1.5 px-1">
                      <div
                        className="rounded-md w-12 h-7 flex items-center justify-center font-semibold tabular-nums"
                        style={val > 0 ? cellStyle(val) : undefined}
                      >
                        <span className={val > 0.55 ? "text-white" : val > 0 ? "text-navy" : "text-navy/20"}>
                          {val === 0 ? "–" : `${Math.round(val * 100)}%`}
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
