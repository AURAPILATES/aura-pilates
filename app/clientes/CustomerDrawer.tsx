"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/app/components/Drawer";
import Avatar from "@/app/components/Avatar";
import Checkbox from "@/app/components/Checkbox";
import { fmt } from "@/lib/analytics";
import { setClientFamilyAction } from "@/app/actions/setClientFamily";
import { ackPaymentErrorAction, unackPaymentErrorAction } from "@/app/actions/ackPaymentError";
import type { StripePayment } from "@/lib/stripePayments";
import {
  type CustomerRow,
  clientStatus,
  planBadgeCfg,
  fmtDate,
  timeAgo,
  paymentExpiry,
  initials,
} from "./ClientesTable";

type Props = {
  customer: CustomerRow;
  payments: StripePayment[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
};

export default function CustomerDrawer({ customer, payments, onClose, onPrev, onNext, hasPrev, hasNext }: Props) {
  const router = useRouter();
  const [stripeOpen, setStripeOpen] = useState(false);
  const [isFamily, setIsFamily] = useState(!!customer.isFamily);
  const [savingFamily, startSaveFamily] = useTransition();

  function toggleFamily() {
    const next = !isFamily;
    setIsFamily(next); // optimista
    startSaveFamily(async () => {
      try {
        await setClientFamilyAction(customer.id, next);
        router.refresh(); // recarga la tabla para actualizar el filtro y el recuento
      } catch {
        setIsFamily(!next); // revierte si falla
      }
    });
  }

  const customerPayments = useMemo(
    () =>
      payments
        .filter((p) => customer.stripeIds.includes(p.customerId ?? ""))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [payments, customer],
  );

  const errorDaysAgo = customer.paymentErrorDate
    ? Math.floor((Date.now() - new Date(customer.paymentErrorDate + "T00:00:00").getTime()) / 86400000)
    : null;

  const [acked, setAcked] = useState(!!customer.paymentErrorAcked);
  const [savingAck, startSaveAck] = useTransition();

  function toggleAcked() {
    const next = !acked;
    setAcked(next); // optimista
    startSaveAck(async () => {
      try {
        if (next) await ackPaymentErrorAction(customer.id, customer.paymentErrorDate);
        else await unackPaymentErrorAction(customer.id);
        router.refresh();
      } catch {
        setAcked(!next); // revierte si falla
      }
    });
  }

  return (
    <Drawer
      maxWidth="max-w-[460px]"
      onPrev={onPrev}
      onNext={onNext}
      hasPrev={hasPrev}
      hasNext={hasNext}
      header={
        <div className="flex items-center gap-4">
          <Avatar seed={customer.id} initials={initials(customer.name, customer.email)} size={48} />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-navy leading-tight truncate">
              {customer.name ?? "Sin nombre"}
            </h2>
            {customer.email && (
              <p className="text-xs text-navy/50 truncate">{customer.email}</p>
            )}
          </div>
        </div>
      }
      headerFull={
        <div className="flex items-center justify-between gap-2 mt-3">
          <div className="flex items-center gap-2 flex-wrap">
            {(() => {
                const dSub  = customer.daysSinceLastSub  ?? Infinity;
                const dPack = customer.daysSinceLastPack ?? Infinity;
                const pt = dSub <= dPack && dSub < Infinity ? "sub"
                         : dPack < Infinity                  ? "pack"
                         : "session";
                const { label, cls } = planBadgeCfg(pt, customer.lastSubProduct, customer.lastPackProduct);
                return <span className={`text-xs ${cls} px-2.5 py-1 rounded-full font-medium`}>{label}</span>;
              })()}
              {(() => {
                const { status, days } = clientStatus(customer);
                if (status === "baja") return (
                  <span className="text-xs bg-danger/10 text-danger px-2.5 py-1 rounded-full font-medium flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger inline-block shrink-0" />
                    {customer.isRecurring ? `Baja · ${days}d sin pagar` : `Pack vencido · ${days}d`}
                  </span>
                );
                if (status === "sinpagar") return (
                  <span className="text-xs bg-warning/10 text-warning px-2.5 py-1 rounded-full font-medium flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block shrink-0" />
                    Sin pagar · {days}d tarde
                  </span>
                );
                if (status === "caducado") return (
                  <span className="text-xs bg-warning/10 text-warning px-2.5 py-1 rounded-full font-medium flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block shrink-0" />
                    Pack vencido · {days}d
                  </span>
                );
                if (status === "porvencer") return (
                  <span className="text-xs bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full font-medium flex items-center gap-1 whitespace-nowrap border border-amber-200/60 dark:border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" />
                    Vence en {days}d
                  </span>
                );
                return (
                  <span className="text-xs bg-success/10 text-success px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                    Al día
                  </span>
                );
              })()}
              {customer.discount && (
                <span className="text-xs bg-warning/10 text-warning px-2.5 py-1 rounded-full font-medium">
                  {customer.discount.percentOff != null
                    ? `-${customer.discount.percentOff}%`
                    : customer.discount.name}
                </span>
              )}
            </div>
            <label className={`flex items-center gap-2 shrink-0 cursor-pointer select-none ${savingFamily ? "opacity-50 pointer-events-none" : ""}`}>
              <Checkbox checked={isFamily} onChange={toggleFamily} disabled={savingFamily} tone="rose" />
              <span className={`text-xs font-medium flex items-center gap-1 whitespace-nowrap ${isFamily ? "text-rose-600 dark:text-rose-400" : "text-navy/60"}`}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Familiar
              </span>
            </label>
          </div>
      }
      footer={(() => {
        const ids = customer.stripeIds;
        const extIcon = (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        );
        if (ids.length === 1) {
          return (
            <a
              href={`https://dashboard.stripe.com/customers/${ids[0]}`}
              target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#635bff] rounded-xl hover:bg-[#4f46e5] transition-colors"
            >
              {extIcon} Ver en Stripe
            </a>
          );
        }
        if (ids.length === 2) {
          return (
            <div className="flex gap-2">
              {ids.map((sid, i) => (
                <a key={sid}
                  href={`https://dashboard.stripe.com/customers/${sid}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-white bg-[#635bff] rounded-xl hover:bg-[#4f46e5] transition-colors"
                >
                  {extIcon} Perfil {i + 1}
                </a>
              ))}
            </div>
          );
        }
        // 3+ perfiles → dropdown
        return (
          <div className="relative">
            <button
              onClick={() => setStripeOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#635bff] rounded-xl hover:bg-[#4f46e5] transition-colors"
            >
              <span className="flex items-center gap-2">{extIcon} Ver en Stripe</span>
              <span className="flex items-center gap-1.5 text-white/70 text-xs font-medium">
                {ids.length} perfiles
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${stripeOpen ? "rotate-180" : ""}`}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            </button>
            {stripeOpen && (
              <div className="absolute bottom-full mb-2 left-0 right-0 bg-card border border-navy/[0.10] rounded-xl shadow-lg overflow-hidden z-10 max-h-52 overflow-y-auto">
                {ids.map((sid, i) => (
                  <a key={sid}
                    href={`https://dashboard.stripe.com/customers/${sid}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-2.5 text-sm font-medium text-[#635bff] hover:bg-[#635bff]/[0.05] border-b border-navy/[0.05] last:border-0 transition-colors"
                  >
                    Perfil {i + 1}
                    <span className="text-[10px] text-navy/30 font-mono">{sid.slice(-8)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })()}
      onClose={onClose}
    >
      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-navy/[0.06] border-b border-navy/[0.07]">
        <div className="px-5 py-4 text-center">
          <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Total gastado</p>
          <p className="text-lg font-bold text-navy tabular-nums">{fmt(customer.totalSpent)}</p>
        </div>
        <div className="px-5 py-4 text-center">
          <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Pagos</p>
          <p className="text-lg font-bold text-navy">{customer.paymentCount}</p>
        </div>
        <div className="px-5 py-4 text-center">
          <p className="text-[10px] text-navy/40 uppercase tracking-wider mb-1">Primer pago</p>
          <p className="text-sm font-semibold text-navy/70">
            {customer.firstPaymentDate ? fmtDate(customer.firstPaymentDate) : "-"}
          </p>
          {customer.firstPaymentDate && (
            <p className="text-[10px] text-navy/35 mt-0.5">{timeAgo(customer.firstPaymentDate)}</p>
          )}
        </div>
      </div>

      {/* Payment list */}
      <p className="px-6 pt-4 pb-2 text-[11px] font-semibold text-navy/40 uppercase tracking-wider">
        Historial de pagos
      </p>

      {customer.hasPaymentError && (
        <div className="mx-6 mb-3 p-4 bg-danger/[0.06] border border-danger/20 rounded-xl">
          <p className="text-xs font-bold text-danger uppercase tracking-wider mb-2">Error de pago</p>
          <div className="space-y-1 text-xs text-navy/70">
            {customer.paymentErrorDate && (
              <p>
                Último intento: <span className="font-medium text-navy">{fmtDate(customer.paymentErrorDate)}</span>
                {errorDaysAgo != null && (
                  <span className="text-navy/45"> (hace {errorDaysAgo} {errorDaysAgo === 1 ? "día" : "días"})</span>
                )}
              </p>
            )}
            {customer.paymentErrorAmount != null && (
              <p>Precio: <span className="font-medium text-navy">{fmt(customer.paymentErrorAmount)}</span></p>
            )}
            {customer.paymentErrorReason && (
              <p>Motivo: <span className="font-medium text-navy">{customer.paymentErrorReason}</span></p>
            )}
          </div>
          <label className={`flex items-center gap-2 mt-3 pt-3 border-t border-danger/15 cursor-pointer select-none ${savingAck ? "opacity-60 pointer-events-none" : ""}`}>
            <Checkbox checked={acked} onChange={toggleAcked} tone="danger" />
            <span className={`text-xs font-medium ${acked ? "text-success" : "text-navy/60"}`}>
              Hablado con cliente
            </span>
          </label>
        </div>
      )}

      <div className="divide-y divide-navy/[0.05]">
        {customerPayments.length === 0 && (
          <p className="px-6 py-8 text-sm text-center text-navy/40">Sin pagos registrados</p>
        )}
        {customerPayments.map((p) => {
          const expiry = paymentExpiry(p);
          const today = new Date().toISOString().split("T")[0];
          const isExpired = expiry != null && expiry < today;
          const isCurrent = expiry != null && expiry >= today;
          return (
            <div key={p.id} className="px-6 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">
                    {p.inferredProduct !== "Otro" ? p.inferredProduct : (p.description ?? p.category)}
                  </p>
                  {p.inferredType === "coupon" && (
                    <span className="shrink-0 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200/80 dark:border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                      cupón
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-navy/45">{fmtDate(p.date)}</p>
                  {expiry && (
                    <p className={`text-[10px] ${isCurrent ? "text-success/70" : "text-navy/30"}`}>
                      · hasta {fmtDate(expiry)}{isExpired ? " (vencido)" : ""}
                    </p>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-navy tabular-nums">
                {fmt(p.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}
