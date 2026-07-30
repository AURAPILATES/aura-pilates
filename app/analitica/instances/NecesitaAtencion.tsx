"use client";

import { useState } from "react";
import ChartCard from "@/components/charts/ChartCard";
import Drawer from "@/app/components/Drawer";
import { StripeIcon, MomenceIcon } from "@/components/icons/SourceIcons";
import { momenceCustomerUrl } from "@/lib/momenceLinks";
import { fmt } from "@/lib/analytics";
import type { AtRiskV2, AtRiskReason, AtRiskItem, AtRiskCustomerInfo } from "@/lib/atRiskV2";

const BADGE: Record<AtRiskReason, string> = {
  "Congelada": "bg-navy/[0.06] text-navy/70",
  "Sin créditos": "bg-danger/10 text-danger",
  "Pocos créditos": "bg-warning/10 text-warning",
  "Caduca pronto": "bg-warning/10 text-warning",
};

function MomenceButton({ memberId }: { memberId: number }) {
  return (
    <a
      href={momenceCustomerUrl(memberId)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6C5CE7] rounded-lg hover:bg-[#5a4bd4] transition-colors"
    >
      <MomenceIcon size={13} />
      Momence
    </a>
  );
}

function StripeButton({ stripeId }: { stripeId: string }) {
  return (
    <a
      href={`https://dashboard.stripe.com/customers/${stripeId}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#635bff] rounded-lg hover:bg-[#4f46e5] transition-colors"
    >
      <StripeIcon size={13} />
      Stripe
    </a>
  );
}

// Lista accionable de retención (packs por agotarse/caducar + congeladas), desde
// el snapshot v2. Cada fila enlaza a la ficha de Momence y, al clicar el nombre,
// abre un drawer con el detalle (datos de Stripe cruzados por email).
export default function NecesitaAtencion({
  data,
  customerInfo,
}: {
  data: AtRiskV2;
  customerInfo: Record<string, AtRiskCustomerInfo>;
}) {
  const [selected, setSelected] = useState<AtRiskItem | null>(null);

  if (!data.date) {
    return <ChartCard title="Necesita atención" subtitle="Aún no hay snapshot de suscripciones v2" />;
  }
  if (data.items.length === 0) {
    return (
      <ChartCard
        title="Necesita atención"
        subtitle="Nadie en riesgo ahora mismo 🎉"
        dataSource="Snapshot diario de Momence (API v2) · packs por agotarse/caducar y suscripciones congeladas"
        sources={["momence"]}
        lastUpdated={`snapshot ${data.date}`}
      />
    );
  }

  const info = selected ? customerInfo[selected.email.toLowerCase()] : undefined;

  return (
    <>
      <ChartCard
        title="Necesita atención"
        subtitle="Packs por agotarse o caducar y suscripciones congeladas — momento de contactar"
        kpiItems={[
          {
            label: "En riesgo",
            value: String(data.items.length),
            valueClassName: "text-warning",
            tooltip: "Total de clientes que necesitan atención ahora: packs por agotarse o agotados, packs por caducar y suscripciones congeladas. Excluye clases sueltas (compra única).",
          },
          {
            label: "Sin créditos",
            value: String(data.counts["Sin créditos"]),
            tooltip: "Packs multi-clase con 0 clases restantes: han gastado todo el bono. Momento ideal para proponer renovación o pasar a suscripción.",
          },
          {
            label: "Caduca pronto",
            value: String(data.counts["Caduca pronto"]),
            tooltip: "Packs que caducan en ≤14 días con clases aún sin usar: conviene avisar antes de que se pierdan.",
          },
        ]}
        dataSource="Snapshot diario de Momence (API v2) · packs multi-clase con ≤2 créditos o que caducan en ≤14 días, y suscripciones congeladas. Excluye clases sueltas (one-off). Clica un cliente para ver el detalle."
        sources={["momence"]}
        lastUpdated={`snapshot ${data.date}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-navy/[0.07] text-navy/50 text-xs">
                <th className="text-left font-medium py-2 pr-3">Cliente</th>
                <th className="text-left font-medium py-2 pr-3">Plan</th>
                <th className="text-left font-medium py-2 pr-3">Motivo</th>
                <th className="text-left font-medium py-2 pr-3">Detalle</th>
                <th className="text-right font-medium py-2" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, i) => {
                const ci = customerInfo[it.email.toLowerCase()];
                return (
                  <tr
                    key={`${it.email}-${i}`}
                    onClick={() => setSelected(it)}
                    className="border-b border-navy/[0.04] cursor-pointer hover:bg-navy/[0.02] transition-colors"
                  >
                    <td className="py-2 pr-3">
                      <span className="text-navy font-medium hover:underline">{ci?.name ?? it.email}</span>
                      {ci?.name && <span className="block text-xs text-navy/45">{it.email}</span>}
                    </td>
                    <td className="py-2 pr-3 text-navy/70">{it.membershipName}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${BADGE[it.reason]}`}>
                        {it.reason}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-navy/60 tabular-nums">{it.detail}</td>
                    <td className="py-2 text-right">
                      <MomenceButton memberId={it.memberId} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {selected && (
        <Drawer maxWidth="max-w-[420px]" onClose={() => setSelected(null)} header={
          <div className="min-w-0">
            <p className="text-base font-semibold text-navy truncate">{info?.name ?? selected.email}</p>
            {info?.name && <p className="text-xs text-navy/50 truncate">{selected.email}</p>}
          </div>
        }>
          <div className="px-5 py-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <MomenceButton memberId={selected.memberId} />
              {info?.stripeId && <StripeButton stripeId={info.stripeId} />}
            </div>

            <div className="p-4 bg-navy/[0.03] rounded-xl space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-navy/50">Plan</span>
                <span className="text-navy font-medium text-right">{selected.membershipName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-navy/50">Motivo</span>
                <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${BADGE[selected.reason]}`}>
                  {selected.reason}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-navy/50">Detalle</span>
                <span className="text-navy/80 text-right tabular-nums">{selected.detail}</span>
              </div>
            </div>

            {info ? (
              <div className="p-4 bg-navy/[0.03] rounded-xl space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-navy/50">Último pago</span>
                  <span className="text-navy/80 text-right">{info.lastPaymentDate ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-navy/50">Histórico gastado</span>
                  <span className="text-navy font-medium text-right tabular-nums">{fmt(info.totalSpent)}</span>
                </div>
                {info.paymentError && (
                  <p className="text-xs text-danger font-medium pt-1">⚠ Tiene un error de pago reciente en Stripe.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-navy/45">Sin datos de pago de Stripe para este email (puede pagar por otra vía o usar otro email).</p>
            )}
          </div>
        </Drawer>
      )}
    </>
  );
}
