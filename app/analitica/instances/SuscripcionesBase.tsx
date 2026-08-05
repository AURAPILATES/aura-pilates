"use client";

import { useState } from "react";
import ChartCard from "@/components/charts/ChartCard";
import Drawer from "@/app/components/Drawer";
import { MomenceIcon } from "@/components/icons/SourceIcons";
import { momenceCustomerUrl } from "@/lib/momenceLinks";
import type { SubscriptionsBaseV2, TierMrrV2 } from "@/lib/subscriptionsV2";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

// Base real de suscripción (desde el snapshot v2 de Momence): suscripciones
// activas por plan y su MRR/ARR. Antes esto no estaba visible en ningún sitio.
export default function SuscripcionesBase({ data }: { data: SubscriptionsBaseV2 }) {
  const [selected, setSelected] = useState<TierMrrV2 | null>(null);

  if (!data.date || data.tiers.length === 0) {
    return (
      <ChartCard title="Base de suscripción" subtitle="Aún no hay snapshot de suscripciones v2" />
    );
  }

  return (
    <>
    <ChartCard
      title="Base de suscripción"
      subtitle="Suscripciones activas por plan y su MRR / ARR. Toca un plan para ver los miembros."
      kpiItems={[
        {
          label: "Suscripciones activas",
          value: String(data.totalSubscriptions),
          helper: `${data.totalMembers} personas`,
          tooltip: "Suscripciones activas y no congeladas ahora mismo en Momence. Se cuenta por suscripción, igual que el panel de Momence: si alguien tiene 2 del mismo plan, cuentan 2. '· personas' = clientes distintos.",
        },
        {
          label: "MRR",
          value: fmtEur(data.totalMrr),
          valueClassName: "text-primary",
          tooltip: "Ingreso Recurrente Mensual: suscripciones activas × precio del plan. La facturación mensual esperada solo por suscripciones (no incluye packs ni clases sueltas).",
        },
        {
          label: "ARR",
          value: fmtEur(data.totalArr),
          tooltip: "Ingreso Recurrente Anual = MRR × 12. Proyección a 12 meses si la base de suscripción se mantiene igual.",
        },
      ]}
      dataSource="Snapshot diario de Momence (API v2) · suscripciones activas no congeladas, contadas por suscripción igual que el panel de Momence"
      sources={["momence"]}
      lastUpdated={`snapshot ${data.date}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-navy/[0.07] text-navy/50 text-xs">
              <th className="text-left font-medium py-2 pr-3">Plan</th>
              <th className="text-right font-medium py-2 pr-3">Activas</th>
              <th className="text-right font-medium py-2 pr-3">Precio</th>
              <th className="text-right font-medium py-2 pr-3">MRR</th>
              <th className="text-right font-medium py-2">ARR</th>
            </tr>
          </thead>
          <tbody>
            {data.tiers.map((t) => (
              <tr
                key={t.name}
                onClick={() => setSelected(t)}
                className="border-b border-navy/[0.04] cursor-pointer hover:bg-navy/[0.02] transition-colors"
              >
                <td className="py-2 pr-3 text-navy font-medium hover:underline">{t.name}</td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{t.activeCount}</td>
                <td className="py-2 pr-3 text-right text-navy/55 tabular-nums">
                  {t.price > 0 ? fmtEur(t.price) : "—"}
                </td>
                <td className="py-2 pr-3 text-right text-navy tabular-nums">{fmtEur(t.mrr)}</td>
                <td className="py-2 text-right text-navy/55 tabular-nums">{fmtEur(t.arr)}</td>
              </tr>
            ))}
            <tr className="font-semibold text-navy">
              <td className="py-2 pr-3">Total</td>
              <td className="py-2 pr-3 text-right tabular-nums">{data.totalSubscriptions}</td>
              <td className="py-2 pr-3" />
              <td className="py-2 pr-3 text-right tabular-nums text-primary">{fmtEur(data.totalMrr)}</td>
              <td className="py-2 text-right tabular-nums">{fmtEur(data.totalArr)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ChartCard>

    {selected && (
      <Drawer
        title={selected.name}
        subtitle={`${selected.activeCount} suscripciones activas · ${fmtEur(selected.mrr)} MRR`}
        onClose={() => setSelected(null)}
      >
        <div className="px-6 py-4 space-y-2">
          {selected.members.map((m) => (
            <div key={m.memberId} className="flex items-center justify-between gap-3 py-2 border-b border-navy/[0.04] last:border-0">
              <p className="text-sm text-navy truncate">{m.email}</p>
              <a
                href={momenceCustomerUrl(m.memberId)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-[#6C5CE7] rounded-lg hover:bg-[#5a4bd4] transition-colors"
              >
                <MomenceIcon size={12} />
                Momence
              </a>
            </div>
          ))}
        </div>
      </Drawer>
    )}
    </>
  );
}
