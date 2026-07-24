import type { PricingRow } from "@/lib/stripePayments";
import { tableHeadClassV2, tableRowClassV2, gridColsV2 } from "@/app/components/v2/tableStylesV2";
import PreciosGuiaDrawer from "./PreciosGuiaDrawer";

const COLS = "1.6fr .9fr 1fr 1fr 1.3fr";

function fmtEur(v: number) {
  return v.toLocaleString("es-ES", { maximumFractionDigits: 0 }) + " €";
}

export default function PreciosViewer({ rows }: { rows: PricingRow[] }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-[13px] text-muted">Precios que usa la app para identificar cada cobro de Stripe.</p>
        <PreciosGuiaDrawer />
      </div>

      {/* Tabla - escritorio */}
      <div className="hidden sm:block">
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
                {usingLive ? fmtEur(row.livePrice!) : "-"}
              </p>
              <p className={`text-right text-[13.5px] tabular-nums ${mismatch ? "text-warning font-medium" : "text-faint"}`}>
                {fmtEur(row.fallbackPrice)}
              </p>
              <div className="flex justify-end">
                <EstadoBadge usingLive={usingLive} mismatch={mismatch} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tarjetas - móvil */}
      <div className="sm:hidden divide-y divide-subtle">
        {rows.map((row) => {
          const usingLive = row.livePrice !== null;
          const mismatch = usingLive && row.livePrice !== row.fallbackPrice;
          return (
            <div key={row.name} className="py-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-navy leading-snug">{row.name}</p>
                  <p className="text-[11.5px] text-muted mt-0.5">{row.type === "subscription" ? "Suscripción" : "Pack"}</p>
                </div>
                <div className="shrink-0">
                  <EstadoBadge usingLive={usingLive} mismatch={mismatch} />
                </div>
              </div>
              <div className="flex items-center gap-4 text-[12.5px]">
                <span className="text-navy/55">
                  Momence{" "}
                  <b className="text-navy font-medium tabular-nums">{usingLive ? fmtEur(row.livePrice!) : "-"}</b>
                </span>
                <span className="text-navy/55">
                  Respaldo{" "}
                  <b className={`font-medium tabular-nums ${mismatch ? "text-warning" : "text-faint"}`}>{fmtEur(row.fallbackPrice)}</b>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EstadoBadge({ usingLive, mismatch }: { usingLive: boolean; mismatch: boolean }) {
  if (!usingLive) {
    return (
      <span
        className="inline-flex items-center gap-1.5 bg-warning/10 text-warning rounded-full px-[11px] py-1 text-[12px] font-medium whitespace-nowrap"
        title="No se encontró este nombre en el catálogo de Momence - se está usando el precio de respaldo del código."
      >
        Usando respaldo
      </span>
    );
  }
  if (mismatch) {
    return (
      <span
        className="inline-flex items-center gap-1.5 bg-warning/10 text-warning rounded-full px-[11px] py-1 text-[12px] font-medium whitespace-nowrap"
        title="El precio de Momence ya no coincide con el de respaldo guardado en el código - no es un problema, solo indica que el precio cambió y el respaldo quedó desactualizado."
      >
        Precio cambió
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-success/10 text-success rounded-full px-[11px] py-1 text-[12px] font-medium whitespace-nowrap">
      En vivo desde Momence
    </span>
  );
}
