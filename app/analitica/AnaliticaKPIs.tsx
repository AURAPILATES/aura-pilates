"use client";

import { useState } from "react";
import { fmt } from "@/lib/analytics";
import Drawer from "@/app/components/Drawer";
import KpiTile from "@/components/charts/KpiTile";
import { hasActiveSub, hasActivePack, isChurned, type EnrichedCustomer } from "@/lib/customerEnrichment";

type DrawerKey = "active" | "new" | "altas" | "churn" | "error" | "convert" | null;

function fmtDate(d: string | null) {
  if (!d) return "—";
  return d.split("-").reverse().join("/");
}

const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
function fmtD(d: string): string {
  const [y, m, day] = d.split("-");
  return `${parseInt(day)} ${MONTHS_ES[parseInt(m) - 1]} ${y}`;
}

type DrawerSection = { title: string; customers: EnrichedCustomer[] };
type DrawerEntry = { title: string; subtitle: string; customers?: EnrichedCustomer[]; sections?: DrawerSection[] };

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
          <span className="text-xs font-semibold text-navy">{fmt(c.totalSpent)}</span>
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

type Props = {
  customers: EnrichedCustomer[];
  periodLabel: string;
  periodFrom: string;
  periodTo: string;
  compDateRange: string;
  grossRevenue: number;
  spendPerClient: number;
  spendPerClientComp: number;
  newCustomers: EnrichedCustomer[];
  reactivatedCustomers: EnrichedCustomer[];
  convertCandidates: EnrichedCustomer[];
};

export default function AnaliticaKPIs({
  customers, periodLabel, periodFrom, periodTo, compDateRange, grossRevenue, spendPerClient, spendPerClientComp,
  newCustomers, reactivatedCustomers, convertCandidates,
}: Props) {
  const [drawer, setDrawer] = useState<DrawerKey>(null);

  const dateRange = `${fmtD(periodFrom)} – ${fmtD(periodTo)}`;

  const activeSubList  = customers.filter(hasActiveSub);
  const activePackList = customers.filter((c) => !hasActiveSub(c) && hasActivePack(c));
  const churnList       = customers.filter(isChurned);
  const delinquentList  = customers.filter((c) => c.hasPaymentError);
  const altasList        = [...newCustomers, ...reactivatedCustomers];

  const drawerConfig: Record<NonNullable<DrawerKey>, DrawerEntry> = {
    active: {
      title: "Activos",
      subtitle: "Con suscripción vigente o pack en plazo",
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

  const activeTotal = activeSubList.length + activePackList.length;
  const subPct  = activeTotal > 0 ? (activeSubList.length  / activeTotal) * 100 : 0;
  const packPct = activeTotal > 0 ? (activePackList.length / activeTotal) * 100 : 0;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <KpiTile
          label="Ingreso medio por clase"
          value="—"
          sub="próximamente"
          valueClassName="text-navy/30"
        />
        <KpiTile
          label="Activos"
          value={activeTotal}
          sub={
            <span className="flex flex-col gap-1.5 w-full">
              <span className="flex w-full h-1.5 rounded-full overflow-hidden bg-navy/[0.06]">
                {subPct > 0 && <span style={{ width: `${subPct}%`, background: "#7F77DD" }} />}
                {packPct > 0 && <span style={{ width: `${packPct}%`, background: "#AFA9EC" }} />}
              </span>
              <span>{activeSubList.length} suscritos · {activePackList.length} packs</span>
            </span>
          }
          tooltip="Suscripción renovada hace ≤30 días, o pack con fecha de caducidad aún vigente (Benvinguda: 15d · Pack 4/8: 90d)"
          valueClassName="text-navy"
          accent="neutral"
          onClick={() => setDrawer("active")}
        />
        <KpiTile
          label="Gasto medio por cliente"
          dateRange={dateRange}
          value={fmt(spendPerClient)}
          delta={{ cur: spendPerClient, prev: spendPerClientComp }}
          compLabel={`${compDateRange} · ${fmt(spendPerClientComp)}`}
          sub={`sobre ${fmt(grossRevenue)} del período`}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <KpiTile
          label="Clientes nuevos"
          dateRange={dateRange}
          value={newCustomers.length}
          sub="primer pago en el período"
          valueClassName="text-success"
          accent="success"
          onClick={newCustomers.length > 0 ? () => setDrawer("new") : undefined}
        />
        <KpiTile
          label="Altas"
          dateRange={dateRange}
          value={`+${altasList.length}`}
          sub={
            newCustomers.length === 0 && reactivatedCustomers.length === 0
              ? "sin altas en el período"
              : `${newCustomers.length} nuevos · ${reactivatedCustomers.length} reactivados`
          }
          valueClassName="text-success"
          accent="success"
          onClick={altasList.length > 0 ? () => setDrawer("altas") : undefined}
        />
        <KpiTile
          label="Sin renovar"
          value={churnList.length}
          sub="entre 46 y 76 días sin pagar"
          valueClassName={churnList.length > 0 ? "text-danger" : "text-navy/50"}
          accent="warning"
          onClick={churnList.length > 0 ? () => setDrawer("churn") : undefined}
        />
        <KpiTile
          label="Error de pago"
          value={delinquentList.length}
          sub="cobro fallido reciente"
          valueClassName={delinquentList.length > 0 ? "text-danger" : "text-navy/50"}
          accent="warning"
          onClick={delinquentList.length > 0 ? () => setDrawer("error") : undefined}
        />
        <KpiTile
          label="Por convertir"
          value={convertCandidates.length}
          sub="2+ packs, sin suscripción"
          tooltip="Clientes con 2 o más compras de pack (sin contar el Pack Benvinguda) que aún no tienen una suscripción activa"
          valueClassName="text-navy"
          accent="primary"
          onClick={convertCandidates.length > 0 ? () => setDrawer("convert") : undefined}
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
                {allCustomers.map((c) => <CustomerRowItem key={c.id} c={c} />)}
              </div>
            )}
          </Drawer>
        );
      })()}
    </>
  );
}
