"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/app/components/Avatar";
import Drawer from "@/app/components/Drawer";
import Checkbox from "@/app/components/Checkbox";
import { fmt } from "@/lib/analytics";
import { setFamilyMemberAction } from "@/app/actions/setClientFamily";
import { ackPaymentErrorAction, unackPaymentErrorAction } from "@/app/actions/ackPaymentError";
import { getMemberNotesAction } from "@/app/actions/getMemberNotes";
import { momenceCustomerUrl } from "@/lib/momenceLinks";
import type { StripePayment } from "@/lib/stripePayments";
import type { MemberClient, StatusTone } from "@/lib/memberClientsV2";
import type { MomenceV2MemberNote } from "@/lib/momenceV2";
import { fmtDate, timeAgo, initials, paymentExpiry } from "./ClientesTable";

// El campo `note` puede traer HTML (schema oficial de Momence); lo pasamos a texto plano para
// mostrarlo simple y sin riesgo de inyectar markup, ya que aquí solo enseñamos texto corto.
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const TONE_CLS: Record<StatusTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-[#b45309]/10 text-[#b45309] dark:text-[#e8a572]",
  danger: "bg-danger/10 text-danger",
  muted: "bg-navy/[0.06] text-navy/55",
};

export default function MemberDrawer({ client, payments, onClose, onPrev, onNext, hasPrev, hasNext }: {
  client: MemberClient; payments: StripePayment[]; onClose: () => void;
  onPrev?: () => void; onNext?: () => void; hasPrev?: boolean; hasNext?: boolean;
}) {
  const router = useRouter();
  const stripe = client.stripe;
  const [isFamily, setIsFamily] = useState(client.isFamily);
  const [savingFamily, startSaveFamily] = useTransition();
  const [acked, setAcked] = useState(!!stripe?.paymentErrorAcked);
  const [savingAck, startSaveAck] = useTransition();
  const [notes, setNotes] = useState<MomenceV2MemberNote[] | null>(null);

  useEffect(() => {
    setNotes(null);
    if (client.memberId == null) return;
    let cancelled = false;
    getMemberNotesAction(client.memberId).then((ns) => { if (!cancelled) setNotes(ns); });
    return () => { cancelled = true; };
  }, [client.memberId]);

  const customerPayments = useMemo(
    () => (stripe ? payments.filter((p) => stripe.stripeIds.includes(p.customerId ?? "")).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [payments, stripe],
  );

  function toggleFamily() {
    if (client.memberId == null) return;
    const next = !isFamily;
    setIsFamily(next);
    startSaveFamily(async () => {
      try { await setFamilyMemberAction(client.memberId!, next); router.refresh(); }
      catch { setIsFamily(!next); }
    });
  }
  function toggleAcked() {
    if (!stripe) return;
    const next = !acked;
    setAcked(next);
    startSaveAck(async () => {
      try {
        if (next) await ackPaymentErrorAction(stripe.primaryId, stripe.paymentErrorDate);
        else await unackPaymentErrorAction(stripe.primaryId);
        router.refresh();
      } catch { setAcked(!next); }
    });
  }

  const plan = client.plan;
  const errorDaysAgo = stripe?.paymentErrorDate
    ? Math.floor((Date.now() - new Date(stripe.paymentErrorDate + "T00:00:00").getTime()) / 86400000)
    : null;

  return (
    <Drawer
      maxWidth="max-w-[460px]"
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
      hasPrev={hasPrev}
      hasNext={hasNext}
      header={
        <div className="flex items-center gap-4">
          <Avatar seed={client.id} initials={initials(client.name, client.email)} size={48} />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-navy leading-tight truncate">{client.name}</h2>
            {client.email && <p className="text-xs text-navy/50 truncate">{client.email}</p>}
            {client.phone && <p className="text-xs text-navy/40 truncate">{client.phone}</p>}
          </div>
        </div>
      }
      headerFull={
        <div className="flex items-center justify-between gap-2 mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${plan ? "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400" : "bg-navy/[0.06] text-navy/55"}`}>
              {plan ? plan.name : "Sin plan"}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 whitespace-nowrap ${TONE_CLS[client.status.tone]}`}>
              {client.status.label}{client.status.detail ? ` · ${client.status.detail}` : ""}
            </span>
            {client.activeSubCount >= 2 && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-danger/10 text-danger whitespace-nowrap" title="Varias suscripciones activas — posible doble cobro">
                ⚠ {client.activeSubCount} suscripciones activas
              </span>
            )}
            {stripe?.discount && (
              <span className="text-xs bg-warning/10 text-warning px-2.5 py-1 rounded-full font-medium">
                {stripe.discount.percentOff != null ? `-${stripe.discount.percentOff}%` : stripe.discount.name}
              </span>
            )}
          </div>
          {client.memberId != null && (
            <label className={`flex items-center gap-2 shrink-0 cursor-pointer select-none ${savingFamily ? "opacity-50 pointer-events-none" : ""}`}>
              <Checkbox checked={isFamily} onChange={toggleFamily} disabled={savingFamily} tone="rose" />
              <span className={`text-xs font-medium whitespace-nowrap ${isFamily ? "text-rose-600 dark:text-rose-400" : "text-navy/60"}`}>Familiar</span>
            </label>
          )}
        </div>
      }
      footer={
        <div className="flex gap-2">
          {client.memberId != null && (
            <a href={momenceCustomerUrl(client.memberId)} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-white bg-navy rounded-xl hover:opacity-90 transition-opacity">
              Ver en Momence
            </a>
          )}
          {stripe && (
            <a href={`https://dashboard.stripe.com/customers/${stripe.stripeIds[0]}`} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-white bg-[#635bff] rounded-xl hover:bg-[#4f46e5] transition-colors">
              Ver en Stripe
            </a>
          )}
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-4 divide-x divide-navy/[0.06] border-b border-navy/[0.07]">
        <div className="px-3 py-4 text-center">
          <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Gastado</p>
          <p className="text-base font-bold text-navy tabular-nums">{stripe ? fmt(stripe.totalSpent) : "-"}</p>
        </div>
        <div className="px-3 py-4 text-center">
          <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Pagos</p>
          <p className="text-base font-bold text-navy">{stripe?.paymentCount ?? "-"}</p>
        </div>
        <div className="px-3 py-4 text-center">
          <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Clases</p>
          <p className="text-base font-bold text-navy">{client.attended}</p>
        </div>
        <div className="px-3 py-4 text-center">
          <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Última</p>
          <p className="text-sm font-semibold text-navy/70">{client.lastClassDate ? timeAgo(client.lastClassDate).replace("Hace ", "") : "-"}</p>
        </div>
      </div>

      {/* Plan real */}
      {plan && (
        <div className="px-6 py-4 border-b border-navy/[0.06]">
          <p className="text-[11px] font-semibold text-navy/40 uppercase tracking-wider mb-2">Plan en Momence</p>
          <div className="space-y-1 text-sm text-navy/70">
            <p>Plan: <span className="font-medium text-navy">{plan.name}</span> {plan.isFrozen && <span className="text-[#b45309] dark:text-[#e8a572]">· congelado</span>}</p>
            {plan.kind === "pack" && plan.creditsLeft != null && plan.creditsTotal != null && (
              <p>Créditos: <span className="font-medium text-navy">{plan.creditsLeft} de {plan.creditsTotal} clases</span></p>
            )}
            {plan.endDate && <p>Caduca: <span className="font-medium text-navy">{fmtDate(plan.endDate.slice(0, 10))}</span></p>}
            {client.planUsage && (
              <p>
                Uso del período:{" "}
                <span className={`font-medium ${client.planUsage.level === "bajo" ? "text-[#b45309] dark:text-[#e8a572]" : client.planUsage.level === "alto" ? "text-primary" : "text-navy"}`}>
                  {client.planUsage.attended} de {client.planUsage.limit} clases
                </span>
                {client.planUsage.level === "bajo" && <span className="text-[#b45309] dark:text-[#e8a572]"> · infrautiliza el plan</span>}
                {client.planUsage.level === "alto" && <span className="text-primary"> · al límite, candidata a subir de plan</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actividad */}
      <div className="px-6 py-4 border-b border-navy/[0.06]">
        <p className="text-[11px] font-semibold text-navy/40 uppercase tracking-wider mb-2">Actividad de clases</p>
        {client.attended > 0 ? (
          <div className="space-y-1 text-sm text-navy/70">
            <p>Clases asistidas: <span className="font-medium text-navy">{client.attended}</span>{client.noShows > 0 && <span className="text-navy/45"> · {client.noShows} no-shows</span>}{client.cancellations > 0 && (
              <span className="text-navy/45">
                {" "}· {client.cancellations} cancelaciones
                {(client.lateCancellations > 0 || client.earlyCancellations > 0) && (
                  <> ({client.lateCancellations} perdidas &lt;12h · {client.earlyCancellations} devueltas)</>
                )}
              </span>
            )}</p>
            {client.coverage === "none" && (
              <p className="text-[#b45309] dark:text-[#e8a572]">Sin pago detectado (asistió sin rastro de pago)</p>
            )}
            {client.firstClassDate && (
              <p>1ª clase: <span className="font-medium text-navy">{fmtDate(client.firstClassDate)}</span>{client.firstTeacher ? ` · ${client.firstTeacher}` : ""}</p>
            )}
            {client.lastClassDate && <p>Última clase: <span className="font-medium text-navy">{fmtDate(client.lastClassDate)}</span> <span className="text-navy/40">({timeAgo(client.lastClassDate)})</span></p>}
          </div>
        ) : (
          <p className="text-sm text-navy/40">Sin clases asistidas registradas.</p>
        )}
      </div>

      {/* Notas CRM (Momence) - carga bajo demanda al abrir la ficha */}
      {client.memberId != null && notes && (
        notes.length > 0 ? (
          <div className="px-6 py-4 border-b border-navy/[0.06]">
            <p className="text-[11px] font-semibold text-navy/40 uppercase tracking-wider mb-2">Notas (Momence)</p>
            <div className="space-y-2.5">
              {notes.map((n) => (
                <div key={n.id} className="p-3 bg-navy/[0.03] rounded-lg">
                  <p className="text-sm text-navy/80 whitespace-pre-wrap">{stripHtml(n.note)}</p>
                  <p className="text-[11px] text-navy/40 mt-1">{fmtDate(n.createdAt.slice(0, 10))}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="px-6 py-2 text-xs text-navy/35">Sin notas en Momence.</p>
        )
      )}

      {/* Error de pago */}
      {stripe?.hasPaymentError && (
        <div className="mx-6 my-4 p-4 bg-danger/[0.06] border border-danger/20 rounded-xl">
          <p className="text-xs font-bold text-danger uppercase tracking-wider mb-2">Error de pago</p>
          <div className="space-y-1 text-xs text-navy/70">
            {stripe.paymentErrorDate && (
              <p>Último intento: <span className="font-medium text-navy">{fmtDate(stripe.paymentErrorDate)}</span>
                {errorDaysAgo != null && <span className="text-navy/45"> (hace {errorDaysAgo} {errorDaysAgo === 1 ? "día" : "días"})</span>}</p>
            )}
            {stripe.paymentErrorAmount != null && <p>Precio: <span className="font-medium text-navy">{fmt(stripe.paymentErrorAmount)}</span></p>}
            {stripe.paymentErrorReason && <p>Motivo: <span className="font-medium text-navy">{stripe.paymentErrorReason}</span></p>}
          </div>
          <label className={`flex items-center gap-2 mt-3 pt-3 border-t border-danger/15 cursor-pointer select-none ${savingAck ? "opacity-60 pointer-events-none" : ""}`}>
            <Checkbox checked={acked} onChange={toggleAcked} tone="danger" />
            <span className={`text-xs font-medium ${acked ? "text-success" : "text-navy/60"}`}>Hablado con cliente</span>
          </label>
        </div>
      )}

      {/* Historial de pagos (Stripe) */}
      <p className="px-6 pt-4 pb-2 text-[11px] font-semibold text-navy/40 uppercase tracking-wider">Historial de pagos</p>
      <div className="divide-y divide-navy/[0.05]">
        {customerPayments.length === 0 && (
          <p className="px-6 py-6 text-sm text-center text-navy/40">{stripe ? "Sin pagos registrados" : "Sin perfil de Stripe (efectivo/Urban/cortesía)"}</p>
        )}
        {customerPayments.map((p) => {
          const expiry = paymentExpiry(p);
          const today = new Date().toISOString().split("T")[0];
          const isCurrent = expiry != null && expiry >= today;
          const isExpired = expiry != null && expiry < today;
          return (
            <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-navy truncate">{p.inferredProduct !== "Otro" ? p.inferredProduct : (p.description ?? p.category)}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-navy/45">{fmtDate(p.date)}</p>
                  {expiry && <p className={`text-[10px] ${isCurrent ? "text-success/70" : "text-navy/30"}`}>· hasta {fmtDate(expiry)}{isExpired ? " (vencido)" : ""}</p>}
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-navy tabular-nums">{fmt(p.amount)}</span>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}
