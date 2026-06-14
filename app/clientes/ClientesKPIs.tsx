"use client";

import { useState, useEffect } from "react";
import { fmt } from "@/lib/analytics";
import type { StripeCustomer } from "@/lib/stripeCustomers";

type CustomerRow = StripeCustomer & { possibleChurn?: boolean; isActive?: boolean; isNew?: boolean };
type DrawerKey = "all" | "active" | "recurring" | "new" | "churn" | null;

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d.split("-").reverse().join("/");
}

function CustomerDrawer({
  title,
  subtitle,
  customers,
  onClose,
}: {
  title: string;
  subtitle: string;
  customers: CustomerRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b border-navy/[0.07]">
          <div>
            <h2 className="text-lg font-bold text-navy font-display">{title}</h2>
            <p className="text-xs text-navy/50 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-navy/40 hover:text-navy/70 hover:bg-navy/[0.05] transition-colors mt-0.5"
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-navy/[0.05]">
          {customers.length === 0 && (
            <p className="px-6 py-12 text-center text-sm text-navy/40">Sin clientes en este grupo.</p>
          )}
          {customers.map((c) => (
            <div key={c.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-navy/[0.015] transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-navy truncate">{c.name ?? "Sin nombre"}</p>
                  {c.isNew && (
                    <span className="shrink-0 text-[10px] font-semibold bg-success/10 text-success px-1.5 py-0.5 rounded-full">Nuevo</span>
                  )}
                </div>
                {c.email && <p className="text-xs text-navy/50 truncate">{c.email}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-navy/45">
                    Último pago: <span className="text-navy/65">{fmtDate(c.lastPaymentDate)}</span>
                  </span>
                  <span className="text-xs font-semibold text-navy">{fmt(c.totalSpent)}</span>
                </div>
              </div>
              <a
                href={`https://dashboard.stripe.com/customers/${c.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#635bff] rounded-lg hover:bg-[#4f46e5] transition-colors"
                title="Ver en Stripe"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Stripe
              </a>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-navy/[0.07] flex items-center justify-between">
          <p className="text-xs text-navy/45">{customers.length} clientes</p>
          <a
            href="https://dashboard.stripe.com/customers"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-navy/50 hover:text-navy/70 underline underline-offset-2 transition-colors"
          >
            Ver todos en Stripe →
          </a>
        </div>
      </div>
    </>
  );
}

type KPICardProps = {
  label: string;
  value: number | string;
  sub: string;
  valueClass?: string;
  onClick?: () => void;
  accent?: "primary" | "success" | "warning" | "neutral";
};

function KPICard({ label, value, sub, valueClass = "text-navy", onClick, accent }: KPICardProps) {
  const hoverBorder = {
    primary: "hover:border-primary/30",
    success:  "hover:border-success/30",
    warning:  "hover:border-warning/40",
    neutral:  "hover:border-navy/20",
  }[accent ?? "neutral"];

  if (!onClick) {
    return (
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-5">
        <p className="text-[11px] text-navy/55 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-semibold ${valueClass}`}>{value}</p>
        <p className="text-[10px] text-navy/35 mt-1.5">{sub}</p>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-5 text-left transition-all group ${hoverBorder} hover:shadow-md`}
    >
      <p className="text-[11px] text-navy/55 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${valueClass} group-hover:opacity-80 transition-opacity`}>{value}</p>
      <p className="text-[10px] text-navy/35 mt-1.5 flex items-center gap-1">
        <span>{sub}</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
      </p>
    </button>
  );
}

type Props = {
  customers: CustomerRow[];
  mrr: number;
  prevMonthLabel: string;
  curMonthLabel: string;
};

export default function ClientesKPIs({ customers, mrr, prevMonthLabel, curMonthLabel }: Props) {
  const [drawer, setDrawer] = useState<DrawerKey>(null);

  const activeList    = customers.filter((c) => c.isActive);
  const recurringList = customers.filter((c) => c.isRecurring);
  const newList       = customers.filter((c) => c.isNew);
  const churnList     = customers.filter((c) => c.possibleChurn);

  const drawerConfig: Record<NonNullable<DrawerKey>, { title: string; subtitle: string; customers: CustomerRow[] }> = {
    all: {
      title: "Todos los clientes",
      subtitle: `${customers.length} clientes en Stripe`,
      customers,
    },
    active: {
      title: "Suscritos",
      subtitle: "Han pagado al menos una vez en los últimos 30 días",
      customers: activeList,
    },
    recurring: {
      title: "Clientes recurrentes",
      subtitle: "Pagaron en 2 o más de los últimos 3 meses",
      customers: recurringList,
    },
    new: {
      title: "Nuevos este mes",
      subtitle: "Su primer pago fue en los últimos 30 días",
      customers: newList,
    },
    churn: {
      title: "Posibles bajas",
      subtitle: `Pagaron en ${prevMonthLabel} pero no en ${curMonthLabel}`,
      customers: churnList,
    },
  };

  return (
    <>
      {/* 5 KPIs: 2 cols móvil, 3+2 en sm, 5 en lg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <KPICard
          label="Suscritos"
          value={activeList.length}
          sub="últimos 30 días"
          valueClass="text-navy"
          accent="neutral"
          onClick={() => setDrawer("active")}
        />
        <KPICard
          label="Recurrentes"
          value={recurringList.length}
          sub="2+ meses de 3"
          valueClass="text-primary"
          accent="primary"
          onClick={() => setDrawer("recurring")}
        />
        <KPICard
          label="Nuevos"
          value={newList.length}
          sub="primer pago 30 días"
          valueClass="text-success"
          accent="success"
          onClick={newList.length > 0 ? () => setDrawer("new") : undefined}
        />
        <KPICard
          label="MRR estimado"
          value={fmt(mrr)}
          sub="media 3 meses"
          valueClass="text-success"
        />
        <KPICard
          label="Posibles bajas"
          value={churnList.length}
          sub={`sin pagar en ${curMonthLabel}`}
          valueClass={churnList.length > 0 ? "text-warning" : "text-navy/50"}
          accent="warning"
          onClick={churnList.length > 0 ? () => setDrawer("churn") : undefined}
        />
      </div>

      {drawer && (
        <CustomerDrawer
          {...drawerConfig[drawer]}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  );
}
