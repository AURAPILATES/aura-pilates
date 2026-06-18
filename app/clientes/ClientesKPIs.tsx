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

const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function fmtD(d: string): string {
  const [y, m, day] = d.split("-");
  return `${parseInt(day)} ${MONTHS_ES[parseInt(m) - 1]} ${y}`;
}

type KPICardProps = {
  label: string;
  value: number | string;
  sub: string;
  tooltip?: string;
  dateRange?: string;
  valueClass?: string;
  onClick?: () => void;
  accent?: "primary" | "success" | "warning" | "neutral";
};

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center">
      <svg
        width="12" height="12" viewBox="0 0 16 16" fill="none"
        className="text-navy/30 hover:text-navy/55 transition-colors cursor-default shrink-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 7v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="8" cy="4.5" r="0.75" fill="currentColor"/>
      </svg>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] rounded-lg bg-navy px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 whitespace-normal text-center">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-navy" />
      </span>
    </span>
  );
}

function KPICard({ label, value, sub, tooltip, dateRange, valueClass = "text-navy", onClick, accent }: KPICardProps) {
  const hoverBorder = {
    primary: "hover:border-primary/30",
    success:  "hover:border-success/30",
    warning:  "hover:border-warning/40",
    neutral:  "hover:border-navy/20",
  }[accent ?? "neutral"];

  const labelEl = (
    <div className="flex items-center gap-1 mb-0.5">
      <p className="text-[11px] text-navy/55 uppercase tracking-wider">{label}</p>
      {tooltip && <InfoTooltip text={tooltip} />}
    </div>
  );

  if (!onClick) {
    return (
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-5">
        {labelEl}
        {dateRange && <p className="text-[10px] text-navy/35 mb-1.5">{dateRange}</p>}
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
      {labelEl}
      {dateRange && <p className="text-[10px] text-navy/35 mb-1.5">{dateRange}</p>}
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
  dateRange: string;
  compDateRange: string;
};

function TrendCard({ label, value, prevLabel, cur, prev, dateRange, compDateRange }: TrendCardProps) {
  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-5">
      <p className="text-[11px] text-navy/55 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[10px] text-navy/35 mb-1.5">{dateRange}</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-2xl font-semibold text-navy">{value}</p>
        <TrendBadge cur={cur} prev={prev} />
      </div>
      <p className="text-[10px] text-navy/35 mt-1.5">{compDateRange} · {prevLabel}</p>
    </div>
  );
}

type DrawerSection = { title: string; customers: CustomerRow[] };
type DrawerEntry = { title: string; subtitle: string; customers?: CustomerRow[]; sections?: DrawerSection[] };

const extIcon = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

function CustomerRow({ c }: { c: CustomerRow }) {
  const [profilesOpen, setProfilesOpen] = useState(false);
  const ids = c.stripeIds;
  const latestId = ids[ids.length - 1];

  return (
    <div className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-navy/[0.015] transition-colors">
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
      <div className="shrink-0 flex items-center gap-1">
        <a
          href={`https://dashboard.stripe.com/customers/${latestId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#635bff] rounded-lg hover:bg-[#4f46e5] transition-colors"
          title="Ver perfil más reciente en Stripe"
        >
          {extIcon}
          Stripe
        </a>
        {ids.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setProfilesOpen((v) => !v)}
              className="text-[10px] font-semibold text-[#635bff] bg-[#635bff]/10 hover:bg-[#635bff]/20 px-1.5 py-1.5 rounded-lg transition-colors leading-none"
              title={`${ids.length} perfiles en Stripe`}
            >
              +{ids.length - 1}
            </button>
            {profilesOpen && (
              <div className="absolute right-0 bottom-full mb-1 w-44 bg-white border border-navy/10 rounded-xl shadow-lg z-20 overflow-hidden">
                {ids.map((sid, i) => (
                  <a
                    key={sid}
                    href={`https://dashboard.stripe.com/customers/${sid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium text-[#635bff] hover:bg-[#635bff]/[0.05] border-b border-navy/[0.05] last:border-0 transition-colors"
                  >
                    Perfil {i + 1}{i === ids.length - 1 ? " · reciente" : ""}
                    <span className="text-[10px] text-navy/30 font-mono">{sid.slice(-6)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type Props = {
  customers: CustomerRow[];
  mrr: number;
  prevMonthLabel: string;
  curMonthLabel: string;
  periodLabel: string;
  periodFrom: string;
  periodTo: string;
  compDateRange: string;
  grossRevenue: number;
  grossRevenueComp: number;
  newCount: number;
  newCountComp: number;
  activeCount: number;
  activeCountComp: number;
};

export default function ClientesKPIs({ customers, mrr, prevMonthLabel, curMonthLabel, periodLabel, periodFrom, periodTo, compDateRange, grossRevenue, grossRevenueComp, newCount, newCountComp, activeCount, activeCountComp }: Props) {
  const [drawer, setDrawer] = useState<DrawerKey>(null);

  // Date range strings for each card
  const dateRange = `${fmtD(periodFrom)} – ${fmtD(periodTo)}`;
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const d30ago = new Date(now); d30ago.setDate(d30ago.getDate() - 30);
  const d90ago = new Date(now); d90ago.setDate(d90ago.getDate() - 90);
  const range30 = `${fmtD(d30ago.toISOString().split("T")[0])} – ${fmtD(todayStr)}`;
  const range90 = `${fmtD(d90ago.toISOString().split("T")[0])} – ${fmtD(todayStr)}`;
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);
  const rangePrevMonth = `${fmtD(prevMonthStart.toISOString().split("T")[0])} – ${fmtD(prevMonthEnd.toISOString().split("T")[0])}`;

  // Activos: suscripción vigente (≤30d) o pack dentro de plazo
  function hasActiveSub(c: CustomerRow): boolean {
    return !!c.isRecurring && c.daysSinceLastSub != null && c.daysSinceLastSub <= 30;
  }
  function hasActivePack(c: CustomerRow): boolean {
    const d = c.daysSinceLastPack;
    if (d == null) return false;
    const prod = c.lastPackProduct;
    if (prod === "Pack Benvinguda") return d <= 15;
    if (prod === "Pack 4 clases" || prod === "Pack 8 clases") return d <= 90;
    return false;
  }
  const activeSubList  = customers.filter(hasActiveSub);
  const activePackList = customers.filter((c) => !hasActiveSub(c) && hasActivePack(c));
  const activeList     = customers.filter((c) => hasActiveSub(c) || hasActivePack(c));

  const recurringList   = customers.filter((c) => c.isRecurring);
  const newList         = customers.filter((c) => c.isNew);
  // Bajas de suscripción: 46-76 días sin pagar (31 días de gracia + 15 de confirmación)
  // Solo suscripciones (daysSinceLastSub), no packs. Tope 76d para no recoger meses anteriores.
  const churnList       = customers.filter((c) => {
    const d = c.daysSinceLastSub;
    return d != null && d >= 46 && d <= 76;
  });
  const delinquentList  = customers.filter((c) => c.hasPaymentError);

  const drawerConfig: Record<NonNullable<DrawerKey>, DrawerEntry> = {
    all: {
      title: "Todos los clientes",
      subtitle: `${customers.length} clientes en Stripe`,
      customers,
    },
    active: {
      title: "Activos",
      subtitle: "Con suscripción vigente o pack en plazo",
      sections: [
        { title: `Suscripción · ${activeSubList.length}`, customers: activeSubList },
        { title: `Pack vigente · ${activePackList.length}`, customers: activePackList },
      ],
    },
    recurring: {
      title: "Clientes recurrentes",
      subtitle: "Pagaron en 2 o más de los últimos 3 meses",
      customers: recurringList,
    },
    new: {
      title: "Clientes nuevos",
      subtitle: `Primer pago en el período · ${periodLabel}`,
      customers: newList,
    },
    churn: {
      title: "Bajas de suscripción",
      subtitle: "Sin renovar entre 46 y 76 días (Bàsic / Plus / Pro)",
      customers: churnList,
    },
    error: {
      title: "Error de pago",
      subtitle: "Stripe no pudo cobrar en los últimos 30 días",
      customers: delinquentList,
    },
  };

  const spendPerClient     = activeCount     > 0 ? grossRevenue     / activeCount     : 0;
  const spendPerClientComp = activeCountComp > 0 ? grossRevenueComp / activeCountComp : 0;

  return (
    <>
      {/* 3 KPIs de tendencia: período seleccionado vs comparación */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <TrendCard
          label="Volumen bruto"
          dateRange={dateRange}
          compDateRange={compDateRange}
          value={fmt(grossRevenue)}
          prevLabel={fmt(grossRevenueComp)}
          cur={grossRevenue}
          prev={grossRevenueComp}
        />
        <TrendCard
          label="Clientes nuevos"
          dateRange={dateRange}
          compDateRange={compDateRange}
          value={String(newCount)}
          prevLabel={String(newCountComp)}
          cur={newCount}
          prev={newCountComp}
        />
        <TrendCard
          label="Gasto por cliente"
          dateRange={dateRange}
          compDateRange={compDateRange}
          value={fmt(spendPerClient)}
          prevLabel={fmt(spendPerClientComp)}
          cur={spendPerClient}
          prev={spendPerClientComp}
        />
      </div>

      {/* 6 KPIs: 2 cols móvil, 3 en sm, 6 en xl */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <KPICard
          label="Activos"
          value={activeList.length}
          sub="suscripción o pack vigente"
          tooltip="Suscripción renovada hace ≤30 días, o pack con fecha de caducidad aún vigente (Benvinguda: 15d · Pack 4/8: 90d)"
          valueClass="text-navy"
          accent="neutral"
          onClick={() => setDrawer("active")}
        />
        <KPICard
          label="Recurrentes"
          dateRange={range90}
          value={recurringList.length}
          sub="2+ meses de 3"
          valueClass="text-primary"
          accent="primary"
          onClick={() => setDrawer("recurring")}
        />
        <KPICard
          label="Nuevos"
          dateRange={dateRange}
          value={newList.length}
          sub="primer pago en el período"
          valueClass="text-success"
          accent="success"
          onClick={newList.length > 0 ? () => setDrawer("new") : undefined}
        />
        <KPICard
          label="MRR estimado"
          dateRange={range90}
          value={fmt(mrr)}
          sub="media 3 meses"
          valueClass="text-success"
        />
        <KPICard
          label="Sin renovar"
          value={churnList.length}
          sub="entre 46 y 76 días sin pagar"
          tooltip="Suscriptoras que llevan entre 46 y 76 días sin renovar — periodo accionable para reactivación"
          valueClass={churnList.length > 0 ? "text-danger" : "text-navy/50"}
          accent="warning"
          onClick={churnList.length > 0 ? () => setDrawer("churn") : undefined}
        />
        <KPICard
          label="Error de pago"
          dateRange={range30}
          value={delinquentList.length}
          sub="cobro fallido reciente"
          valueClass={delinquentList.length > 0 ? "text-danger" : "text-navy/50"}
          accent="warning"
          onClick={delinquentList.length > 0 ? () => setDrawer("error") : undefined}
        />
      </div>

      {drawer && (() => {
        const cfg = drawerConfig[drawer];
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
                      : section.customers.map((c) => <CustomerRow key={c.id} c={c} />)
                    }
                  </div>
                ))}
              </>
            ) : (
              <div className="divide-y divide-navy/[0.05]">
                {allCustomers.length === 0 && (
                  <p className="px-6 py-12 text-center text-sm text-navy/40">Sin clientes en este grupo.</p>
                )}
                {allCustomers.map((c) => <CustomerRow key={c.id} c={c} />)}
              </div>
            )}
          </Drawer>
        );
      })()}
    </>
  );
}
