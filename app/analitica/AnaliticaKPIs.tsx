"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CreditCard } from "react-feather";
import { fmt } from "@/lib/analytics";
import Drawer from "@/app/components/Drawer";
import { ChartCard, ProportionBar } from "@/components/charts";
import { hasActiveSub, hasActivePack, isChurned, type EnrichedCustomer } from "@/lib/customerEnrichment";
import type { MomenceChurnResult } from "@/lib/subscriberSnapshots";
import { ackPaymentErrorAction } from "@/app/actions/ackPaymentError";

type DrawerKey = "active" | "new" | "altas" | "churn" | "error" | "convert" | "baja_momence" | "alta_momence" | null;

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d.split("-").reverse().join("/");
}

const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function fmtD(d: string): string {
  const [y, m, day] = d.split("-");
  return `${parseInt(day)} ${MONTHS_ES[parseInt(m) - 1]} ${y}`;
}

function fmtShort(d: string): string {
  const [, m, day] = d.split("-");
  return `${parseInt(day)} ${MONTHS_ES[parseInt(m) - 1]}`;
}

type DrawerSection = { title: string; customers: EnrichedCustomer[] };
type DrawerEntry = { title: string; subtitle: string; customers?: EnrichedCustomer[]; sections?: DrawerSection[] };

const extIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

function CustomerRowItem({
  c, showError, onAck, acking, acked,
}: {
  c: EnrichedCustomer;
  showError?: boolean;
  onAck?: () => void;
  acking?: boolean;
  acked?: boolean;
}) {
  const latestId = c.stripeIds[c.stripeIds.length - 1];
  return (
    <div className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-navy/[0.015] transition-colors">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy truncate">{c.name ?? "Sin nombre"}</p>
        {c.email && <p className="text-xs text-navy/50 truncate">{c.email}</p>}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-navy/45">
            Último pago: <span className="text-navy/65">{fmtDate(c.lastPaymentDate)}</span>
          </span>
          <span className="text-xs font-semibold text-navy">{fmt(c.totalSpent)}</span>
        </div>
        {showError && c.paymentErrorReason && (
          <p className="text-xs text-danger mt-1">{c.paymentErrorReason}</p>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <a
          href={`https://dashboard.stripe.com/customers/${latestId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#635bff] rounded-lg hover:bg-[#4f46e5] transition-colors"
        >
          {extIcon}
          Stripe
        </a>
        {onAck && (
          <button
            type="button"
            onClick={onAck}
            disabled={acking || acked}
            title="Ya hablé con la clienta sobre este cobro fallido: deja de estar aquí como pendiente hasta que falle un cobro nuevo."
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap disabled:cursor-default ${
              acked
                ? "border-success/30 bg-success/10 text-success"
                : "border-navy/15 text-navy/60 hover:text-navy hover:border-navy/30"
            }`}
          >
            {acked ? "Hablado ✓" : acking ? "Guardando…" : "Ya hablé con ella"}
          </button>
        )}
      </div>
    </div>
  );
}

type Props = {
  customers: EnrichedCustomer[];
  periodLabel: string;
  periodFrom: string;
  periodTo: string;
  compDateRange: string;
  spendPerClient: number;
  spendPerClientComp: number;
  newCustomers: EnrichedCustomer[];
  reactivatedCustomers: EnrichedCustomer[];
  convertCandidates: EnrichedCustomer[];
  activeMomenceSubCount: number;
  activeRecurringCount: number;
  momenceChurn: MomenceChurnResult | null;
};

export default function AnaliticaKPIs({
  customers, periodLabel, periodFrom, periodTo, compDateRange, spendPerClient, spendPerClientComp,
  newCustomers, reactivatedCustomers, convertCandidates, activeMomenceSubCount, activeRecurringCount, momenceChurn,
}: Props) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [ackedIds, setAckedIds] = useState<Set<string>>(new Set());

  async function handleAck(c: EnrichedCustomer) {
    setAckingId(c.id);
    try {
      await ackPaymentErrorAction(c.id, c.paymentErrorDate);
      setAckedIds((prev) => new Set(prev).add(c.id));
      router.refresh();
    } finally {
      setAckingId(null);
    }
  }

  const dateRange = `${fmtD(periodFrom)} – ${fmtD(periodTo)}`;

  const activeSubList  = customers.filter(hasActiveSub);
  const activePackList = customers.filter((c) => !hasActiveSub(c) && hasActivePack(c));
  const churnList       = customers.filter(isChurned);
  const delinquentList  = customers.filter((c) => c.hasPaymentError);
  const altasList       = [...newCustomers, ...reactivatedCustomers];

  // Base activa verificada: suscripciones según Momence (fuente de verdad) + packs activos
  const activeTotal = activeMomenceSubCount + activePackList.length;

  const momenceChurnDrawer = drawer === "baja_momence" || drawer === "alta_momence";
  const momenceDrawerData = drawer === "baja_momence" ? momenceChurn?.churned : momenceChurn?.gained;
  const momenceDrawerTitle = drawer === "baja_momence"
    ? `Bajas confirmadas · ${momenceChurn ? fmtShort(momenceChurn.refDate) + " – " + fmtShort(momenceChurn.compareDate) : ""}`
    : `Altas de suscripción · ${momenceChurn ? fmtShort(momenceChurn.refDate) + " – " + fmtShort(momenceChurn.compareDate) : ""}`;
  const momenceDrawerSubtitle = drawer === "baja_momence"
    ? "Estaban activas en Momence al inicio del período y ya no aparecen hoy"
    : "No estaban en Momence al inicio del período y sí aparecen hoy";

  const drawerConfig: Record<Exclude<NonNullable<DrawerKey>, "baja_momence" | "alta_momence">, DrawerEntry> = {
    active: {
      title: "Activos (historial Stripe)",
      subtitle: "Aproximación por historial de cobros · para detalle exacto ver Momence",
      sections: [
        { title: `Suscripción · ${activeSubList.length}`, customers: activeSubList },
        { title: `Pack vigente · ${activePackList.length}`, customers: activePackList },
      ],
    },
    new: {
      title: "Clientes nuevos",
      subtitle: `Primer pago en el período · ${periodLabel}`,
      customers: newCustomers,
    },
    altas: {
      title: "Altas",
      subtitle: `Nuevos y reactivados en el período · ${periodLabel}`,
      sections: [
        { title: `Nuevos · ${newCustomers.length}`, customers: newCustomers },
        { title: `Reactivados · ${reactivatedCustomers.length}`, customers: reactivatedCustomers },
      ],
    },
    churn: {
      title: "Bajas de suscripción",
      subtitle: "Sin renovar entre 46 y 76 días",
      customers: churnList,
    },
    error: {
      title: "Error de pago",
      subtitle: "Stripe no pudo cobrar en los últimos 30 días",
      customers: delinquentList,
    },
    convert: {
      title: "Por convertir a suscripción",
      subtitle: "2 o más compras de pack (sin contar Benvinguda), sin suscripción activa",
      customers: convertCandidates,
    },
  };

  const subPct  = activeTotal > 0 ? (activeMomenceSubCount / activeTotal) * 100 : 0;
  const packPct = activeTotal > 0 ? (activePackList.length  / activeTotal) * 100 : 0;

  const spendDeltaPct = spendPerClientComp > 0
    ? Math.round(((spendPerClient - spendPerClientComp) / spendPerClientComp) * 100)
    : null;

  const churnRiskTotal = churnList.length + delinquentList.length;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* ── Clientes activos: base activa + movimiento del período ── */}
        <div className="lg:col-span-3 min-w-0">
          <ChartCard
            title="Clientes activos"
            subtitle="Base activa y movimiento del período"
            dateRange={dateRange}
            kpiItems={[
              {
                label: "Activos",
                value: activeTotal,
                helper: "subs + packs activos",
                tooltip: "Clientes con membresía activa en Momence o con un pack vigente. Haz clic para ver el listado completo.",
                onClick: () => setDrawer("active"),
              },
              {
                label: "Suscripciones",
                value: activeMomenceSubCount,
                helper: `${activeRecurringCount} recurrentes (≥2m)`,
                tooltip: "Membresías Basic, Plus o Pro activas y no congeladas ahora mismo según Momence. El helper muestra cuántas de ellas llevan ≥2 meses seguidos pagando y pagaron en los últimos 30 días (fuente: Stripe).",
              },
              {
                label: "Packs activos",
                value: activePackList.length,
                tooltip: "Clientes sin suscripción que compraron un pack hace ≤90 días (Pack Benvinguda: ≤15 días). Fuente: historial Stripe.",
                onClick: activePackList.length > 0 ? () => setDrawer("active") : undefined,
              },
              {
                label: "Gasto medio",
                value: fmt(spendPerClient),
                helper: spendDeltaPct !== null
                  ? `${spendDeltaPct >= 0 ? "+" : ""}${spendDeltaPct}% vs ${compDateRange}`
                  : undefined,
                tooltip: "Facturación total del período ÷ clientes únicos que pagaron. Solo Stripe.",
              },
              {
                label: "Por convertir",
                value: convertCandidates.length,
                valueClassName: convertCandidates.length > 0 ? "text-primary" : "text-navy/50",
                helper: "2+ packs, sin sub.",
                tooltip: "Compraron 2 o más packs (sin contar Benvinguda) pero nunca han tenido suscripción. Son el perfil ideal para proponer un plan mensual.",
                onClick: convertCandidates.length > 0 ? () => setDrawer("convert") : undefined,
              },
            ]}
            dataSource="Suscripciones: membresías activas no congeladas en Momence · Packs activos: compra hace ≤90 días (Benvinguda: 15d)"
            sources={["stripe"]}
            lastUpdated="ahora"
          >
            {activeTotal > 0 && (
              <ProportionBar
                segments={[
                  { label: "Suscripciones", color: "#7F77DD", percentage: Math.round(subPct) },
                  { label: "Packs activos", color: "#AFA9EC", percentage: Math.round(packPct) },
                ]}
              />
            )}

            <div className="mt-5 pt-4 border-t border-navy/[0.07]">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-[11px] font-medium text-navy/45">Movimiento</p>
                <div className="flex items-center gap-2">
                  {altasList.length > 0 && (
                    <span className="text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                      +{altasList.length} altas
                    </span>
                  )}
                  {momenceChurn && momenceChurn.churned.length > 0 && (
                    <span className="text-xs font-semibold text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                      −{momenceChurn.churned.length} bajas
                    </span>
                  )}
                </div>
              </div>

              {/* Fila 1: Stripe */}
              <p className="text-[11px] text-navy/35 mb-2">Stripe · período seleccionado</p>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <button
                  type="button"
                  onClick={newCustomers.length > 0 ? () => setDrawer("new") : undefined}
                  className="text-left"
                  disabled={newCustomers.length === 0}
                  title="Clientes cuyo primer pago registrado en Stripe cae dentro del período seleccionado."
                >
                  <div className="text-[11px] text-navy/50 mb-1">Nuevos</div>
                  <div className="text-[20px] font-medium text-success leading-tight">+{newCustomers.length}</div>
                  <div className="text-[11px] text-navy/50 mt-0.5">primer pago</div>
                </button>
                <button
                  type="button"
                  onClick={reactivatedCustomers.length > 0 ? () => setDrawer("altas") : undefined}
                  className="text-left"
                  disabled={reactivatedCustomers.length === 0}
                  title="Clientes que ya habían pagado antes pero llevaban más de 60 días sin hacerlo y volvieron a pagar en el período."
                >
                  <div className="text-[11px] text-navy/50 mb-1">Reactivados</div>
                  <div className="text-[20px] font-medium text-success leading-tight">+{reactivatedCustomers.length}</div>
                  <div className="text-[11px] text-navy/50 mt-0.5">volvieron tras un hueco</div>
                </button>
                <button
                  type="button"
                  onClick={altasList.length > 0 ? () => setDrawer("altas") : undefined}
                  className="text-left"
                  disabled={altasList.length === 0}
                  title="Nuevos + reactivados en el período. Son todas las altas netas sin contar bajas."
                >
                  <div className="text-[11px] text-navy/50 mb-1">Total altas</div>
                  <div className="text-[20px] font-medium text-success leading-tight">+{altasList.length}</div>
                </button>
              </div>

              {/* Fila 2: Momence snapshots */}
              {momenceChurn && (
                <>
                  <p className="text-[11px] text-navy/35 mb-2">
                    Momence · {fmtShort(momenceChurn.refDate)} – {fmtShort(momenceChurn.compareDate)}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={momenceChurn.churned.length > 0 ? () => setDrawer("baja_momence") : undefined}
                      className="text-left"
                      disabled={momenceChurn.churned.length === 0}
                      title={`Suscriptoras que estaban activas en Momence el ${fmtShort(momenceChurn.refDate)} y ya no aparecen hoy. Baja confirmada.`}
                    >
                      <div className="text-[11px] text-navy/50 mb-1">Bajas</div>
                      <div className="text-[20px] font-medium text-danger leading-tight">−{momenceChurn.churned.length}</div>
                      <div className="text-[11px] text-navy/50 mt-0.5">salieron de Momence</div>
                    </button>
                    <button
                      type="button"
                      onClick={momenceChurn.gained.length > 0 ? () => setDrawer("alta_momence") : undefined}
                      className="text-left"
                      disabled={momenceChurn.gained.length === 0}
                      title={`Suscriptoras que no estaban en Momence el ${fmtShort(momenceChurn.refDate)} y sí aparecen hoy.`}
                    >
                      <div className="text-[11px] text-navy/50 mb-1">Altas sub.</div>
                      <div className="text-[20px] font-medium text-success leading-tight">+{momenceChurn.gained.length}</div>
                      <div className="text-[11px] text-navy/50 mt-0.5">nuevas en Momence</div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </ChartCard>
        </div>

        {/* ── Riesgo de baja: estado actual, no respeta el filtro de período ── */}
        <div className="lg:col-span-1 min-w-0">
          <ChartCard
            title="Riesgo de baja"
            subtitle="Suscriptoras sin renovar y cobros fallidos recientes"
            dateRange="Estado actual"
            kpiItems={[
              {
                label: "Sin renovar",
                value: churnList.length,
                valueClassName: churnList.length > 0 ? "text-danger" : "text-navy/50",
                helper: (
                  <>
                    46-76 días sin pagar
                    {churnList.length > 0 && (
                      <span className="flex items-center gap-1 mt-1.5 text-[11px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full w-fit whitespace-nowrap">
                        <AlertTriangle size={11} className="shrink-0" /> Contactar
                      </span>
                    )}
                  </>
                ),
                tooltip: "Suscriptoras con historial en Stripe que llevan entre 46 y 76 días sin renovar. Ventana crítica: probablemente cancelaron pero aún se puede recuperar. Haz clic para ver quiénes son.",
                onClick: churnList.length > 0 ? () => setDrawer("churn") : undefined,
              },
              {
                label: "Error de pago",
                value: delinquentList.length,
                valueClassName: delinquentList.length > 0 ? "text-danger" : "text-navy/50",
                helper: (
                  <>
                    últimos 30 días
                    {delinquentList.length > 0 && (
                      <span className="flex items-center gap-1 mt-1.5 text-[11px] font-medium text-danger bg-danger/10 px-2 py-0.5 rounded-full w-fit whitespace-nowrap">
                        <CreditCard size={11} className="shrink-0" /> Revisar pago
                      </span>
                    )}
                  </>
                ),
                tooltip: "Stripe intentó cobrar en los últimos 30 días pero el cargo fue rechazado. El cliente sigue suscrito pero no está pagando. Requiere acción inmediata.",
                onClick: delinquentList.length > 0 ? () => setDrawer("error") : undefined,
              },
            ]}
            dataSource="Stripe · suscripciones Bàsic / Plus / Pro · no respeta el filtro de período, siempre estado actual"
            sources={["stripe"]}
            lastUpdated="ahora"
          >
            {churnRiskTotal > 0 && (
              <div className="-mx-4 sm:-mx-5 -mb-4 mt-1 flex items-center justify-between bg-danger/[0.06] px-4 sm:px-5 py-2.5">
                <span className="text-xs font-semibold text-danger">Total en riesgo</span>
                <span className="text-sm font-semibold text-danger tabular-nums">{churnRiskTotal}</span>
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      {drawer && momenceChurnDrawer && momenceDrawerData && (
        <Drawer
          title={momenceDrawerTitle}
          subtitle={momenceDrawerSubtitle}
          maxWidth="max-w-[420px]"
          footer={<p className="text-xs text-navy/45">{momenceDrawerData.length} suscriptoras · fuente: Momence snapshots</p>}
          onClose={() => setDrawer(null)}
        >
          <div className="divide-y divide-navy/[0.05]">
            {momenceDrawerData.length === 0 && (
              <p className="px-6 py-12 text-center text-sm text-navy/40">Sin datos.</p>
            )}
            {momenceDrawerData.map((entry) => (
              <div key={entry.email} className="px-6 py-4">
                <p className="text-sm font-semibold text-navy truncate">{entry.email}</p>
                <p className="text-xs text-navy/50 mt-0.5">{entry.tier}</p>
              </div>
            ))}
          </div>
        </Drawer>
      )}

      {drawer && !momenceChurnDrawer && (() => {
        const cfg = drawerConfig[drawer as Exclude<NonNullable<DrawerKey>, "baja_momence" | "alta_momence">];
        const allCustomers = cfg.sections
          ? cfg.sections.flatMap((s) => s.customers)
          : (cfg.customers ?? []);
        return (
          <Drawer
            title={cfg.title}
            subtitle={cfg.subtitle}
            maxWidth="max-w-[420px]"
            footer={
              <div className="flex items-center justify-between">
                <p className="text-xs text-navy/45">{allCustomers.length} clientes</p>
                <a
                  href="https://dashboard.stripe.com/customers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-navy/50 hover:text-navy/70 underline underline-offset-2 transition-colors"
                >
                  Ver todos en Stripe →
                </a>
              </div>
            }
            onClose={() => setDrawer(null)}
          >
            {cfg.sections ? (
              <>
                {cfg.sections.map((section) => (
                  <div key={section.title}>
                    <p className="px-6 pt-4 pb-1 text-[11px] font-semibold text-navy/40 uppercase tracking-wider">{section.title}</p>
                    {section.customers.length === 0
                      ? <p className="px-6 py-3 text-xs text-navy/35 italic">Sin clientes en este grupo.</p>
                      : section.customers.map((c) => <CustomerRowItem key={c.id} c={c} />)
                    }
                  </div>
                ))}
              </>
            ) : (
              <div className="divide-y divide-navy/[0.05]">
                {allCustomers.length === 0 && (
                  <p className="px-6 py-12 text-center text-sm text-navy/40">Sin clientes en este grupo.</p>
                )}
                {allCustomers.map((c) => (
                  <CustomerRowItem
                    key={c.id}
                    c={c}
                    showError={drawer === "error"}
                    onAck={drawer === "error" ? () => handleAck(c) : undefined}
                    acking={ackingId === c.id}
                    acked={ackedIds.has(c.id)}
                  />
                ))}
              </div>
            )}
          </Drawer>
        );
      })()}
    </>
  );
}
