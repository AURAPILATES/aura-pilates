"use client";

import { useState } from "react";
import ChartCard from "@/components/charts/ChartCard";
import Drawer from "@/app/components/Drawer";
import TablePaginationV2 from "@/app/components/v2/TablePaginationV2";
import { StripeIcon, MomenceIcon } from "@/components/icons/SourceIcons";
import { momenceCustomerUrl } from "@/lib/momenceLinks";
import { fmt } from "@/lib/analytics";
import type { AtRiskV2, AtRiskReason, AtRiskItem, AtRiskCustomerInfo } from "@/lib/atRiskV2";

const PAGE_SIZE = 10;

const BADGE: Record<AtRiskReason, string> = {
  "Congelada": "bg-navy/[0.06] text-navy/70",
  "Sin créditos": "bg-danger/10 text-danger",
  "Pocos créditos": "bg-warning/10 text-warning",
  "Caduca pronto": "bg-warning/10 text-warning",
  "Sin venir": "bg-danger/10 text-danger",
  "Asistencia en caída": "bg-warning/10 text-warning",
};

// Por qué esta fila necesita atención en concreto — se muestra en la tabla (title) y en el
// drawer, para que quede claro qué hacer con cada motivo sin tener que recordarlo.
const EXPLANATION: Record<AtRiskReason, string> = {
  "Congelada": "Ha congelado su suscripción o pack: sigue siendo cliente, pero no está viniendo ni pagando activamente. Buen momento para preguntar cuándo vuelve.",
  "Sin créditos": "Ha gastado todas las clases de su pack y aún no ha renovado. Riesgo de que no vuelva si nadie le ofrece el siguiente paso (renovar o pasar a suscripción).",
  "Pocos créditos": "Le quedan muy pocas clases del pack. Anticiparse a ofrecer renovación antes de que se quede sin plazas evita un hueco sin clase entre packs.",
  "Caduca pronto": "Su pack caduca pronto y aún tiene clases sin usar: si no viene a tiempo, pierde lo que ya pagó. Avisarle es tanto retención como buen servicio.",
  "Sin venir": "Sigue pagando la suscripción pero hace tiempo que no pisa el estudio. Es la señal más clara de baja inminente: paga por algo que no usa, y eso no dura.",
  "Asistencia en caída": "Su ritmo de clases se ha reducido a la mitad o menos en el último mes frente al anterior. Suele preceder a dejar de venir del todo — conviene entender qué ha cambiado.",
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
  const [page, setPage] = useState(0);

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
  const totalPages = Math.max(1, Math.ceil(data.items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = data.items.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <>
      <ChartCard
        title="Necesita atención"
        subtitle="Packs por agotarse o caducar, suscripciones congeladas y suscriptores que dejan de venir — momento de contactar"
        kpiItems={[
          {
            label: "En riesgo",
            value: String(data.items.length),
            valueClassName: "text-warning",
            tooltip: "Total de clientes que necesitan atención ahora: packs por agotarse o agotados, packs por caducar, suscripciones congeladas y suscriptores que han dejado de venir. Excluye clases sueltas (compra única).",
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
          {
            label: "Sin venir",
            value: String(data.counts["Sin venir"] + data.counts["Asistencia en caída"]),
            tooltip: "Churn temprano por comportamiento: suscriptores activos que no pisan clase desde hace ≥21 días, o que en las últimas 4 semanas vienen la mitad o menos que en las 4 anteriores. Pagan pero no vienen — los siguientes en darse de baja si nadie les escribe. Ojo: en vacaciones (agosto) esta señal se dispara más de lo normal.",
          },
        ]}
        dataSource="Snapshot diario de Momence (API v2) · packs multi-clase con ≤2 créditos o que caducan en ≤14 días, suscripciones congeladas, y churn temprano por comportamiento (asistencia real de class_bookings_v2: sin venir ≥21 días o frecuencia a la mitad en 4 semanas). Excluye clases sueltas (one-off). En períodos de vacaciones la señal de asistencia se dispara más. Clica un cliente para ver el detalle."
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
              {pageItems.map((it, i) => {
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
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium cursor-help ${BADGE[it.reason]}`}
                        title={EXPLANATION[it.reason]}
                      >
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

        {totalPages > 1 && (
          <TablePaginationV2 page={safePage} totalItems={data.items.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        )}
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

            <div className="p-4 bg-navy/[0.03] rounded-[8px] space-y-2 text-sm">
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

            <div className="p-4 bg-warning/[0.06] border border-warning/15 rounded-[8px]">
              <p className="text-xs font-semibold text-warning mb-1">¿Por qué necesita atención?</p>
              <p className="text-xs text-navy/70 leading-relaxed">{EXPLANATION[selected.reason]}</p>
            </div>

            {info ? (
              <div className="p-4 bg-navy/[0.03] rounded-[8px] space-y-2 text-sm">
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
