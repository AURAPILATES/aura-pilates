"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CreditCard, UserPlus, DollarSign, Activity, Users } from "react-feather";
import { fmt } from "@/lib/analytics";
import Drawer from "@/app/components/Drawer";
import Checkbox from "@/app/components/Checkbox";
import DeltaBadge, { pctDelta, type DeltaDirection } from "@/components/charts/DeltaBadge";
import { InfoDot } from "@/components/charts";
import { isChurned, type EnrichedCustomer } from "@/lib/customerEnrichment";
import { ackPaymentErrorAction, unackPaymentErrorAction } from "@/app/actions/ackPaymentError";

type DrawerKey = "convert" | "churn" | "error" | null;

function fmtDate(d: string | null) {
  if (!d) return "-";
  return d.split("-").reverse().join("/");
}

const extIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

function CustomerRowItem({ c }: { c: EnrichedCustomer }) {
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
          <span className="text-xs text-navy/45">
            Histórico: <span className="text-navy/65 font-semibold">{fmt(c.totalSpent)}</span>
          </span>
        </div>
      </div>
      <a
        href={`https://dashboard.stripe.com/customers/${latestId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#635bff] rounded-lg hover:bg-[#4f46e5] transition-colors"
      >
        {extIcon}
        Stripe
      </a>
    </div>
  );
}

/** Fila del drawer "Error de pago": misma caja roja suave que en el drawer de cliente
 * (Clientes > CustomerDrawer), sin el historial de compras - aquí solo interesa el error. */
function PaymentErrorRow({
  c, acked, onToggleAck, saving,
}: {
  c: EnrichedCustomer;
  acked: boolean;
  onToggleAck: () => void;
  saving: boolean;
}) {
  const latestId = c.stripeIds[c.stripeIds.length - 1];
  const errorDaysAgo = c.paymentErrorDate
    ? Math.floor((Date.now() - new Date(c.paymentErrorDate + "T00:00:00").getTime()) / 86400000)
    : null;
  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy truncate">{c.name ?? "Sin nombre"}</p>
          {c.email && <p className="text-xs text-navy/50 truncate">{c.email}</p>}
        </div>
        <a
          href={`https://dashboard.stripe.com/customers/${latestId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#635bff] rounded-lg hover:bg-[#4f46e5] transition-colors"
        >
          {extIcon}
          Stripe
        </a>
      </div>
      <div className="p-4 bg-danger/[0.06] border border-danger/20 rounded-xl">
        <p className="text-xs font-bold text-danger uppercase tracking-wider mb-2">Error de pago</p>
        <div className="space-y-1 text-xs text-navy/70">
          {c.paymentErrorDate && (
            <p>
              Último intento: <span className="font-medium text-navy">{fmtDate(c.paymentErrorDate)}</span>
              {errorDaysAgo != null && (
                <span className="text-navy/45"> (hace {errorDaysAgo} {errorDaysAgo === 1 ? "día" : "días"})</span>
              )}
            </p>
          )}
          {c.paymentErrorAmount != null && (
            <p>Precio: <span className="font-medium text-navy">{fmt(c.paymentErrorAmount)}</span></p>
          )}
          {c.paymentErrorReason && (
            <p>Motivo: <span className="font-medium text-navy">{c.paymentErrorReason}</span></p>
          )}
        </div>
        <label className={`flex items-center gap-2 mt-3 pt-3 border-t border-danger/15 cursor-pointer select-none ${saving ? "opacity-60 pointer-events-none" : ""}`}>
          <Checkbox checked={acked} onChange={onToggleAck} tone="danger" />
          <span className={`text-xs font-medium ${acked ? "text-success" : "text-navy/60"}`}>
            Hablado con cliente
          </span>
        </label>
      </div>
    </div>
  );
}

function StatBox({
  icon, label, value, valueClassName, tooltip, onClick, delta,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  valueClassName?: string;
  tooltip: string;
  onClick?: () => void;
  delta?: { value: string; direction: DeltaDirection };
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full text-left bg-card border border-border rounded-[14px] px-4 sm:px-5 py-4 ${
        onClick ? "hover:bg-navy/[0.015] transition-colors cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 text-navy/50 mb-2.5">
        {icon}
        <span className="text-[13px] font-medium">{label}</span>
        <InfoDot text={tooltip} />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-2xl font-medium leading-tight tabular-nums ${valueClassName ?? "text-navy"}`}>
          {value}
        </span>
        {delta && <DeltaBadge value={delta.value} direction={delta.direction} />}
      </div>
    </Comp>
  );
}

type DrawerEntry = { title: string; subtitle: string; customers: EnrichedCustomer[] };

export default function AnaliticaKPIs({
  customers, convertCandidates, spendPerClient, occupancyAvg, avgPerClass,
  spendPerClientComp, occupancyAvgComp, avgPerClassComp, activeSubEmailsV2,
}: {
  customers: EnrichedCustomer[];
  convertCandidates: EnrichedCustomer[];
  /** Emails con suscripción activa en Momence (snapshot v2), para depurar el churn inferido por Stripe. */
  activeSubEmailsV2: Set<string>;
  spendPerClient: number;
  occupancyAvg: number;
  avgPerClass: number;
  /** Mismos valores calculados sobre el período de comparación - solo para el badge de variación. */
  spendPerClientComp: number;
  occupancyAvgComp: number;
  avgPerClassComp: number;
}) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<DrawerKey>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [ackOverrides, setAckOverrides] = useState<Record<string, boolean>>({});

  function isAcked(c: EnrichedCustomer): boolean {
    return ackOverrides[c.id] ?? !!c.paymentErrorAcked;
  }

  async function handleToggleAck(c: EnrichedCustomer) {
    const next = !isAcked(c);
    setAckOverrides((prev) => ({ ...prev, [c.id]: next })); // optimista
    setAckingId(c.id);
    try {
      if (next) await ackPaymentErrorAction(c.id, c.paymentErrorDate);
      else await unackPaymentErrorAction(c.id);
      router.refresh();
    } catch {
      setAckOverrides((prev) => ({ ...prev, [c.id]: !next })); // revierte si falla
    } finally {
      setAckingId(null);
    }
  }

  // Stripe infiere el churn por huecos de pago (46-76 d); quitamos a quien Momence
  // (v2) confirma que SIGUE con suscripción activa: eran falsos positivos.
  const churnList      = customers.filter(isChurned).filter((c) => !activeSubEmailsV2.has((c.email ?? "").toLowerCase()));
  const delinquentList = customers.filter((c) => c.hasPaymentError);

  const drawerConfig: Record<Exclude<DrawerKey, null>, DrawerEntry> = {
    convert: {
      title: "Por convertir a suscripción",
      subtitle: "2 o más compras de pack (sin contar Benvinguda), sin suscripción activa",
      customers: convertCandidates,
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
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <StatBox
            icon={<UserPlus size={14} />}
            label="Por convertir"
            value={convertCandidates.length}
            valueClassName={convertCandidates.length > 0 ? "text-primary" : "text-navy/50"}
            tooltip="Compraron 2 o más packs (sin contar Benvinguda) pero nunca han tenido suscripción. Son el perfil ideal para proponer un plan mensual."
            onClick={convertCandidates.length > 0 ? () => setDrawer("convert") : undefined}
          />
        </div>
        <StatBox
          icon={<AlertTriangle size={14} />}
          label="Sin renovar"
          value={churnList.length}
          valueClassName={churnList.length > 0 ? "text-danger" : "text-navy/50"}
          tooltip="Suscriptoras con historial en Stripe que llevan entre 46 y 76 días sin renovar Y que ya no figuran como suscripción activa en Momence (cruzado con la API v2 para quitar falsos positivos). Ventana crítica: probablemente cancelaron pero aún se puede recuperar."
          onClick={churnList.length > 0 ? () => setDrawer("churn") : undefined}
        />
        <StatBox
          icon={<CreditCard size={14} />}
          label="Error de pago"
          value={delinquentList.length}
          valueClassName={delinquentList.length > 0 ? "text-danger" : "text-navy/50"}
          tooltip="Stripe intentó cobrar en los últimos 30 días pero el cargo fue rechazado. El cliente sigue suscrito pero no está pagando."
          onClick={delinquentList.length > 0 ? () => setDrawer("error") : undefined}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <StatBox
            icon={<DollarSign size={14} />}
            label="Gasto medio por alumno"
            value={fmt(spendPerClient)}
            tooltip="Facturación total del período ÷ clientes únicos que pagaron. Solo Stripe."
            delta={pctDelta(spendPerClient, spendPerClientComp)}
          />
        </div>
        <StatBox
          icon={<Activity size={14} />}
          label="Ocupación media"
          value={`${Math.round(occupancyAvg * 100)}%`}
          valueClassName={occupancyAvg >= 0.7 ? "text-success" : occupancyAvg >= 0.4 ? "text-warning" : "text-danger"}
          tooltip="Plazas vendidas ÷ plazas totales en el período. Fuente: Momence."
          delta={pctDelta(occupancyAvg, occupancyAvgComp)}
        />
        <StatBox
          icon={<Users size={14} />}
          label="Media de alumnos/clase"
          value={avgPerClass.toFixed(1)}
          tooltip="Alumnos por clase de media en el período. Fuente: Momence."
          delta={pctDelta(avgPerClass, avgPerClassComp)}
        />
      </div>

      {drawer && (() => {
        const cfg = drawerConfig[drawer];
        return (
          <Drawer
            title={cfg.title}
            subtitle={cfg.subtitle}
            maxWidth="max-w-[420px]"
            footer={
              <div className="flex items-center justify-between">
                <p className="text-xs text-navy/45">{cfg.customers.length} clientes</p>
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
            <div className="divide-y divide-navy/[0.05]">
              {cfg.customers.length === 0 && (
                <p className="px-6 py-12 text-center text-sm text-navy/40">Sin clientes en este grupo.</p>
              )}
              {cfg.customers.map((c) =>
                drawer === "error" ? (
                  <PaymentErrorRow
                    key={c.id}
                    c={c}
                    acked={isAcked(c)}
                    onToggleAck={() => handleToggleAck(c)}
                    saving={ackingId === c.id}
                  />
                ) : (
                  <CustomerRowItem key={c.id} c={c} />
                ),
              )}
            </div>
          </Drawer>
        );
      })()}
    </>
  );
}
