import type { PricingRow } from "@/lib/stripePayments";
import { tableHeadClassV2, tableRowClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";

const COLS = "1.6fr .9fr 1fr 1fr 1.3fr";

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

export default function PreciosViewer({ rows }: { rows: PricingRow[] }) {
  return (
    <div>
      <p className="text-[13px] text-muted leading-relaxed mb-5 max-w-[640px]">
        Precios que usa la app para identificar a qué producto corresponde cada cobro de Stripe.
        Se leen en vivo del catálogo de Momence (membresías y productos) por nombre exacto; si un
        nombre no se encuentra ahí, se usa el precio de respaldo guardado en el código. Esta vista
        es solo de lectura — para cambiar un precio, hazlo en Momence.
      </p>

      <div className={tableHeadClassV2} style={gridColsV2(COLS)}>
        <span>Producto</span>
        <span>Tipo</span>
        <span className="text-right">Precio en Momence</span>
        <span className="text-right">Respaldo (código)</span>
        <span className="text-right">Estado</span>
      </div>

      {rows.map((row) => {
        const usingLive = row.livePrice !== null;
        const mismatch = usingLive && row.livePrice !== row.fallbackPrice;
        return (
          <div key={row.name} className={tableRowClassV2} style={gridColsV2(COLS)}>
            <p className="text-[13.5px] font-medium text-navy truncate">{row.name}</p>
            <p className="text-[12.5px] text-muted">{row.type === "subscription" ? "Suscripción" : "Pack"}</p>
            <p className="text-right text-[13.5px] tabular-nums text-navy">
              {usingLive ? fmtEur(row.livePrice!) : "—"}
            </p>
            <p className={`text-right text-[13.5px] tabular-nums ${mismatch ? "text-warning font-medium" : "text-faint"}`}>
              {fmtEur(row.fallbackPrice)}
            </p>
            <div className="flex justify-end">
              {!usingLive ? (
                <span
                  className="inline-flex items-center gap-1.5 bg-warning/10 text-warning rounded-full px-[11px] py-1 text-[12px] font-medium whitespace-nowrap"
                  title="No se encontró este nombre en el catálogo de Momence — se está usando el precio de respaldo del código."
                >
                  Usando respaldo
                </span>
              ) : mismatch ? (
                <span
                  className="inline-flex items-center gap-1.5 bg-warning/10 text-warning rounded-full px-[11px] py-1 text-[12px] font-medium whitespace-nowrap"
                  title="El precio de Momence ya no coincide con el de respaldo guardado en el código — no es un problema, solo indica que el precio cambió y el respaldo quedó desactualizado."
                >
                  Precio cambió
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-success/10 text-success rounded-full px-[11px] py-1 text-[12px] font-medium whitespace-nowrap">
                  En vivo desde Momence
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
