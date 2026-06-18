import { fmt } from "@/lib/analytics";
import type { PaymentsBreakdown } from "@/lib/stripePayments";

type Props = PaymentsBreakdown & { succeeded: number };

const ITEMS = [
  { key: "succeeded" as const, label: "Efectuado",    color: "#635bff", bg: "bg-[#635bff]" },
  { key: "refunded"  as const, label: "Reembolsada",  color: "#0ea5e9", bg: "bg-[#0ea5e9]" },
  { key: "disputed"  as const, label: "Bloqueado",    color: "#f97316", bg: "bg-[#f97316]" },
  { key: "failed"    as const, label: "Error",        color: "#dc2626", bg: "bg-[#dc2626]" },
];

export default function ClientesPaymentsBreakdown({ succeeded, refunded, disputed, failed }: Props) {
  const values = { succeeded, refunded, disputed, failed };
  const total  = succeeded + refunded + disputed + failed;

  const visible = ITEMS.filter((it) => values[it.key] > 0 || it.key === "succeeded");

  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-navy">Resumen de pagos</p>
        <p className="text-[11px] text-navy/40">Últimos 30 días</p>
      </div>

      {/* Barra proporcional */}
      <div className="flex rounded-full overflow-hidden h-2 mb-4 gap-[2px]">
        {total === 0
          ? <div className="flex-1 bg-navy/[0.06]" />
          : visible.map((it) => (
              values[it.key] > 0 && (
                <div
                  key={it.key}
                  className={it.bg}
                  style={{ width: `${(values[it.key] / total) * 100}%` }}
                />
              )
            ))}
      </div>

      {/* Desglose */}
      <div className="divide-y divide-navy/[0.05]">
        {visible.map((it) => (
          <div key={it.key} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <span className={`w-2 h-2 rounded-full ${it.bg} shrink-0`} />
              <span className="text-sm text-navy/65">{it.label}</span>
            </div>
            <span className={`text-sm font-semibold tabular-nums ${it.key === "succeeded" ? "text-navy" : "text-navy/60"}`}>
              {fmt(values[it.key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
