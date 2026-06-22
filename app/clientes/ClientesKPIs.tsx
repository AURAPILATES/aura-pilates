"use client";

import { useState } from "react";
import { fmt } from "@/lib/analytics";
import Drawer from "@/app/components/Drawer";
import KpiTile from "@/components/charts/KpiTile";
import { type CustomerRow, clientStatus } from "./ClientesTable";
type DrawerKey = "all" | "new" | null;

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d.split("-").reverse().join("/");
}

const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function fmtD(d: string): string {
  const [y, m, day] = d.split("-");
  return `${parseInt(day)} ${MONTHS_ES[parseInt(m) - 1]} ${y}`;
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
        {c.hasPaymentError && c.paymentErrorReason && (
          <p className="text-xs text-danger mt-1">{c.paymentErrorReason}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1">
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
  const d90ago = new Date(now); d90ago.setDate(d90ago.getDate() - 90);
  const range90 = `${fmtD(d90ago.toISOString().split("T")[0])} – ${fmtD(now.toISOString().split("T")[0])}`;

  const newList = customers.filter((c) => c.isNew);

  const drawerConfig: Record<NonNullable<DrawerKey>, DrawerEntry> = {
    all: {
      title: "Todos los clientes",
      subtitle: `${customers.length} clientes en Stripe`,
      customers,
    },
    new: {
      title: "Clientes nuevos",
      subtitle: `Primer pago en el período · ${periodLabel}`,
      customers: newList,
    },
  };

  return (
    <>
      {/* 3 KPIs de tendencia: período seleccionado vs comparación */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <KpiTile
          label="Volumen bruto"
          dateRange={dateRange}
          value={fmt(grossRevenue)}
          delta={{ cur: grossRevenue, prev: grossRevenueComp }}
          compLabel={`${compDateRange} · ${fmt(grossRevenueComp)}`}
        />
        <KpiTile
          label="Clientes nuevos"
          dateRange={dateRange}
          value={String(newCount)}
          delta={{ cur: newCount, prev: newCountComp }}
          compLabel={`${compDateRange} · ${String(newCountComp)}`}
          tooltip="Clientes (deduplicados por email) cuyo primer pago, en cualquiera de sus perfiles de Stripe, cae en el período"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
        <KpiTile
          label="Nuevos"
          dateRange={dateRange}
          value={newList.length}
          sub="primer pago en el período"
          valueClassName="text-success"
          accent="success"
          onClick={newList.length > 0 ? () => setDrawer("new") : undefined}
        />
        <KpiTile
          label="MRR estimado"
          dateRange={range90}
          value={fmt(mrr)}
          sub="media 3 meses"
          valueClassName="text-success"
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
