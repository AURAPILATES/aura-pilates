"use client";

import { useState } from "react";
import { fmt } from "@/lib/analytics";
import Drawer from "@/app/components/Drawer";
import { type CustomerRow, clientStatus } from "./ClientesTable";
type DrawerKey = "all" | "active" | "recurring" | "new" | "churn" | "error" | null;

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d.split("-").reverse().join("/");
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

function pct(cur: number, prev: number): number {
  if (prev === 0) return 0;
  return ((cur - prev) / prev) * 100;
}

function TrendBadge({ cur, prev }: { cur: number; prev: number }) {
  const p = pct(cur, prev);
  if (p === 0 || prev === 0) return null;
  const pos = p > 0;
  return (
    <span className={`text-xs font-semibold ${pos ? "text-success" : "text-danger"}`}>
      {pos ? "+" : ""}{p.toFixed(2).replace(".", ",")} %
    </span>
  );
}

type TrendCardProps = {
  label: string;
  value: string;
  prevLabel: string;
  cur: number;
  prev: number;
};

function TrendCard({ label, value, prevLabel, cur, prev }: TrendCardProps) {
  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-5">
      <p className="text-[11px] text-navy/55 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-2xl font-semibold text-navy">{value}</p>
        <TrendBadge cur={cur} prev={prev} />
      </div>
      <p className="text-[10px] text-navy/35 mt-1.5">{prevLabel} período anterior</p>
    </div>
  );
}

type Props = {
  customers: CustomerRow[];
  mrr: number;
  prevMonthLabel: string;
  curMonthLabel: string;
  grossRevenue30d: number;
  grossRevenuePrev30d: number;
  newCount30d: number;
  newCountPrev30d: number;
  activeCount30d: number;
  activeCountPrev30d: number;
};

export default function ClientesKPIs({ customers, mrr, prevMonthLabel, curMonthLabel, grossRevenue30d, grossRevenuePrev30d, newCount30d, newCountPrev30d, activeCount30d, activeCountPrev30d }: Props) {
  const [drawer, setDrawer] = useState<DrawerKey>(null);

  const activeList      = customers.filter((c) => c.isActive);
  const recurringList   = customers.filter((c) => c.isRecurring);
  const newList         = customers.filter((c) => c.isNew);
  const churnList       = customers.filter((c) => clientStatus(c).status !== "ok");
  const delinquentList  = customers.filter((c) => c.hasPaymentError);

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
    error: {
      title: "Error de pago",
      subtitle: "Stripe no pudo cobrar en los últimos 30 días",
      customers: delinquentList,
    },
  };

  const spendPerClient30d     = activeCount30d     > 0 ? grossRevenue30d     / activeCount30d     : 0;
  const spendPerClientPrev30d = activeCountPrev30d > 0 ? grossRevenuePrev30d / activeCountPrev30d : 0;

  return (
    <>
      {/* 3 KPIs de tendencia: últimos 30d vs período anterior */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <TrendCard
          label="Volumen bruto"
          value={fmt(grossRevenue30d)}
          prevLabel={fmt(grossRevenuePrev30d)}
          cur={grossRevenue30d}
          prev={grossRevenuePrev30d}
        />
        <TrendCard
          label="Clientes nuevos"
          value={String(newCount30d)}
          prevLabel={String(newCountPrev30d)}
          cur={newCount30d}
          prev={newCountPrev30d}
        />
        <TrendCard
          label="Gasto por cliente"
          value={fmt(spendPerClient30d)}
          prevLabel={fmt(spendPerClientPrev30d)}
          cur={spendPerClient30d}
          prev={spendPerClientPrev30d}
        />
      </div>

      {/* 6 KPIs: 2 cols móvil, 3 en sm, 6 en xl */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
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
        <KPICard
          label="Error de pago"
          value={delinquentList.length}
          sub="últimos 30 días"
          valueClass={delinquentList.length > 0 ? "text-danger" : "text-navy/50"}
          accent="warning"
          onClick={delinquentList.length > 0 ? () => setDrawer("error") : undefined}
        />
      </div>

      {drawer && (
        <Drawer
          title={drawerConfig[drawer].title}
          subtitle={drawerConfig[drawer].subtitle}
          maxWidth="max-w-[420px]"
          footer={
            <div className="flex items-center justify-between">
              <p className="text-xs text-navy/45">{drawerConfig[drawer].customers.length} clientes</p>
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
            {drawerConfig[drawer].customers.length === 0 && (
              <p className="px-6 py-12 text-center text-sm text-navy/40">Sin clientes en este grupo.</p>
            )}
            {drawerConfig[drawer].customers.map((c) => (
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
        </Drawer>
      )}
    </>
  );
}
