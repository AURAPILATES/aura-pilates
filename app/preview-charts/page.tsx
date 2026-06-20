"use client";

import { BarChart2, Activity } from "react-feather";
import {
  ChartCard,
  KpiCard,
  RunwayDots,
  ProportionBar,
  CohortTable,
  ToggleGroup,
  ChartTypeToggle,
  Legend,
} from "@/components/charts";
import MrrPorTier from "@/app/finanzas/instances/MrrPorTier";
import DesglosGastos from "@/app/finanzas/instances/DesglosGastos";
import ConversionPack from "@/app/finanzas/instances/ConversionPack";
import EvolucionSuscripciones from "@/app/finanzas/instances/EvolucionSuscripciones";
import ResumenFinanzas from "@/app/finanzas/instances/ResumenFinanzas";
import VolumenBruto from "@/app/finanzas/instances/VolumenBruto";
import FuentesIngreso from "@/app/finanzas/instances/FuentesIngreso";
import IngresosPorProducto from "@/app/finanzas/instances/IngresosPorProducto";
import EvolucionInscritos from "@/app/finanzas/instances/EvolucionInscritos";
import RetencionCohorte from "@/app/finanzas/instances/RetencionCohorte";
import type { StripePayment } from "@/lib/stripePayments";
import { computeRetentionCohorts } from "@/lib/subscriptionCohort";

function mockPayment(id: string, date: string, customerId: string): StripePayment {
  return {
    id, date, customerId, amount: 75, fee: 2, net: 73,
    customerName: null, customerEmail: null, description: null,
    method: "card", category: "Suscripción", inferredProduct: "Bàsic", inferredType: "subscription",
  };
}
const MOCK_PAYMENTS: StripePayment[] = [
  mockPayment("1", "2026-02-05", "c1"), mockPayment("2", "2026-02-08", "c2"),
  mockPayment("3", "2026-03-05", "c1"), mockPayment("4", "2026-03-08", "c2"), mockPayment("5", "2026-03-12", "c3"),
  mockPayment("6", "2026-04-05", "c1"), mockPayment("7", "2026-04-08", "c2"), mockPayment("8", "2026-04-12", "c3"), mockPayment("9", "2026-04-15", "c4"),
  mockPayment("10", "2026-05-05", "c1"), mockPayment("11", "2026-05-12", "c3"), mockPayment("12", "2026-05-15", "c4"),
  mockPayment("13", "2026-06-05", "c1"), mockPayment("14", "2026-06-15", "c4"),
];
import type { Sale } from "@/lib/sales";
import type { Transaction } from "@/lib/transactions";

const MOCK_SALES: Sale[] = [
  { paymentDate: "2026-04-05", serviceDate: "2026-04-05", amount: 4000, tax: 0, item: "Bàsic", category: "Suscripción", email: "a@x.com", name: "A", method: "Tarjeta" },
  { paymentDate: "2026-05-05", serviceDate: "2026-05-05", amount: 4200, tax: 0, item: "Bàsic", category: "Suscripción", email: "a@x.com", name: "A", method: "Tarjeta" },
  { paymentDate: "2026-06-05", serviceDate: "2026-06-05", amount: 4500, tax: 0, item: "Bàsic", category: "Suscripción", email: "a@x.com", name: "A", method: "Tarjeta" },
];
const MOCK_TXNS: Transaction[] = [
  { id: "1", date: "2026-04-10", amount: -1200, balance: null, concept: "Alquiler", contact: "Propietario", labels: null, category: "Alquiler", contact_type: "proveedor", notes: null, source: "manual", payment_method: "banco", created_at: "2026-04-10T00:00:00Z", deleted_at: null },
  { id: "2", date: "2026-05-10", amount: -1200, balance: null, concept: "Alquiler", contact: "Propietario", labels: null, category: "Alquiler", contact_type: "proveedor", notes: null, source: "manual", payment_method: "banco", created_at: "2026-04-10T00:00:00Z", deleted_at: null },
  { id: "3", date: "2026-06-10", amount: -1200, balance: null, concept: "Alquiler", contact: "Propietario", labels: null, category: "Alquiler", contact_type: "proveedor", notes: null, source: "manual", payment_method: "banco", created_at: "2026-04-10T00:00:00Z", deleted_at: null },
];

const MOCK_MONTHLY_REVENUE = [
  { month: "2026-02", label: "Feb 2026", total: 1250, items: [{ name: "Pack Benvinguda", revenue: 600 }, { name: "Bàsic", revenue: 400 }, { name: "Otros", revenue: 250 }] },
  { month: "2026-03", label: "Mar 2026", total: 4282, items: [{ name: "Pack Benvinguda", revenue: 2000 }, { name: "Bàsic", revenue: 1500 }, { name: "Otros", revenue: 782 }] },
  { month: "2026-04", label: "Abr 2026", total: 8485, items: [{ name: "Pack Benvinguda", revenue: 4000 }, { name: "Bàsic", revenue: 3500 }, { name: "Otros", revenue: 985 }] },
  { month: "2026-05", label: "May 2026", total: 9237, items: [{ name: "Pack Benvinguda", revenue: 4500 }, { name: "Bàsic", revenue: 4000 }, { name: "Otros", revenue: 737 }] },
  { month: "2026-06", label: "Jun 2026", total: 4857, items: [{ name: "Pack Benvinguda", revenue: 2200 }, { name: "Bàsic", revenue: 2000 }, { name: "Otros", revenue: 657 }] },
];
const MOCK_COHORTS = [
  { month: "2026-02", label: "Feb 2026", revenue: 1250, activeCount: 4, newSubs: 4, churned: 0, reactivated: 0 },
  { month: "2026-03", label: "Mar 2026", revenue: 4282, activeCount: 28, newSubs: 26, churned: 2, reactivated: 0 },
  { month: "2026-04", label: "Abr 2026", revenue: 8485, activeCount: 65, newSubs: 47, churned: 11, reactivated: 1 },
  { month: "2026-05", label: "May 2026", revenue: 9237, activeCount: 65, newSubs: 24, churned: 26, reactivated: 2 },
  { month: "2026-06", label: "Jun 2026", revenue: 4857, activeCount: 37, newSubs: 9, churned: 39, reactivated: 2 },
];

const MOCK_CONVERSION_SUMMARY = {
  totalBuyers: 151,
  totalConverted: 59,
  rate: 0.391,
  avgDaysToConvert: 24,
  medianDaysToConvert: 20,
  cohorts: [
    { month: "2026-02", label: "Feb 2026", buyers: 35, converted: 15, rate: 0.429, avgDaysToConvert: 18, buyersDetail: [] },
    { month: "2026-03", label: "Mar 2026", buyers: 53, converted: 20, rate: 0.377, avgDaysToConvert: 22, buyersDetail: [] },
    { month: "2026-04", label: "Abr 2026", buyers: 30, converted: 15, rate: 0.5, avgDaysToConvert: 19, buyersDetail: [] },
    { month: "2026-05", label: "May 2026", buyers: 19, converted: 7, rate: 0.368, avgDaysToConvert: 27, buyersDetail: [] },
    { month: "2026-06", label: "Jun 2026", buyers: 14, converted: 2, rate: 0.143, avgDaysToConvert: 30, buyersDetail: [] },
  ],
};

const MOCK_EXPENSE_CATEGORIES = [
  { category: "Salarios", count: 9, total: 2196, color: "#378ADD" },
  { category: "Impuestos y tasas", count: 6, total: 1517, color: "#E24B4A" },
  { category: "Gestoría y legal", count: 9, total: 1270, color: "#7F77DD" },
  { category: "Alquiler", count: 9, total: 1224, color: "#EF9F27" },
  { category: "Merchandising", count: 4, total: 492, color: "#5DCAA5" },
  { category: "Software", count: 12, total: 411, color: "#F0997B" },
  { category: "Otros", count: 7, total: 676, color: "#B4B2A9" },
];
const MOCK_TXNS_BY_CATEGORY = {
  Salarios: [{ date: "2026-06-05", amount: -1098, concept: "Nómina", contact: "Equipo" }],
};

export default function PreviewChartsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <h1 className="text-lg font-display text-navy mb-2">Preview · componentes de gráficos</h1>

      {/* ChartCard con KPI único + toolbar + AI insight */}
      <ChartCard
        title="Volumen bruto"
        subtitle="Ingresos totales cobrados por Stripe en el periodo seleccionado"
        dateRange="21 may – 20 jun 2026"
        kpi={{
          value: "8.713 €",
          delta: { value: "+8,26%", direction: "pos" },
          comparison: (
            <>
              vs período anterior <b className="text-navy font-medium">8.048 €</b> · 20 abr – 20 may 2026
            </>
          ),
        }}
        toolbar={
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <ChartTypeToggle
                value="line"
                onChange={() => {}}
                options={[
                  { value: "bar", label: "Ver como barras", icon: <BarChart2 size={14} /> },
                  { value: "line", label: "Ver como línea", icon: <Activity size={14} /> },
                ]}
              />
              <Legend items={[{ label: "Ingresos", color: "#378ADD" }, { label: "Gastos", color: "#F0997B" }]} />
            </div>
            <ToggleGroup
              value="mes"
              onChange={() => {}}
              options={[
                { value: "semana", label: "Semana" },
                { value: "mes", label: "Mes" },
                { value: "trimestre", label: "Trimestre" },
              ]}
            />
          </>
        }
        chartDescription="Evolución mensual de ingresos y gastos, diciembre 2025 a mayo 2026"
        aiInsight={
          <>
            Los ingresos superaron a los gastos por primera vez en <b>abril 2026</b>, marcando el punto de
            breakeven operativo.
          </>
        }
        dataSource="Ingresos: Momence sales.csv · Gastos: exportación bancaria CaixaBank"
      >
        <div className="h-32 rounded-lg bg-navy/[0.04] flex items-center justify-center text-xs text-navy/40">
          (placeholder gráfico de líneas)
        </div>
      </ChartCard>

      {/* ChartCard con KPI multi */}
      <ChartCard
        title="Evolución de inscritos"
        subtitle="Clientes únicos con al menos un pago por mes"
        dateRange="Desde apertura"
        kpiItems={[
          { label: "Activos jun", value: "84", valueClassName: "text-primary" },
          { label: "Pico histórico", value: <>106 <span className="text-xs text-navy/50 font-normal">abr</span></> },
          { label: "Vs mes ant.", value: "−20%", valueClassName: "text-danger" },
        ]}
      >
        <div className="h-32 rounded-lg bg-navy/[0.04] flex items-center justify-center text-xs text-navy/40">
          (placeholder gráfico de barras)
        </div>
      </ChartCard>

      {/* CohortTable */}
      <ChartCard
        title="Retención por cohorte"
        subtitle="% del grupo inicial que volvió a pagar cada mes siguiente"
        dateRange="Feb – Jun 2026"
        kpiItems={[
          { label: "Retención M+1 media", value: "26%", valueClassName: "text-primary" },
          { label: "Mejor cohorte M+1", value: <>37% <span className="text-xs text-navy/50 font-normal">abr</span></>, valueClassName: "text-success" },
          { label: "Cohortes activas", value: "5" },
        ]}
      >
        <CohortTable
          columns={["M+1", "M+2", "M+3", "M+4"]}
          rows={[
            { label: "Feb 26", n: 41, values: [15, 24, 17, 12] },
            { label: "Mar 26", n: 78, values: [23, 19, 17, null] },
            { label: "Abr 26", n: 78, values: [37, 15, null, null] },
            { label: "May 26", n: 54, values: [30, null, null, null] },
            { label: "Jun 26", n: 38, values: [null, null, null, null] },
          ]}
        />
      </ChartCard>

      {/* KpiCard simple */}
      <KpiCard
        title="Resultado de junio"
        subtitle="Snapshot del mes"
        kpi={{
          value: "+5.169 €",
          delta: { value: "ingresos − gastos", direction: "neu" },
        }}
        dataSource="CaixaBank · Momence · Stripe · datos a 20 jun 2026"
      />

      {/* ProportionBar */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl p-4 sm:p-5">
        <p className="text-sm font-medium text-navy mb-3">Fuentes de ingreso</p>
        <ProportionBar
          segments={[
            { label: "Recurrentes", color: "#7F77DD", percentage: 67, displayValue: "5.860 €" },
            { label: "Pagos únicos", color: "#5DCAA5", percentage: 33, displayValue: "2.853 €" },
          ]}
        />
      </div>

      {/* MrrPorTier (instancia real, con datos de ejemplo) */}
      <MrrPorTier
        tiers={[
          { name: "Bàsic", price: 75, mrr: 1650, arr: 19800, activeCount: 22 },
          { name: "Plus", price: 140, mrr: 420, arr: 5040, activeCount: 3 },
          { name: "Pro", price: 180, mrr: 0, arr: 0, activeCount: 0 },
        ]}
      />

      {/* DesglosGastos (instancia real, con datos de ejemplo) */}
      <DesglosGastos
        categories={MOCK_EXPENSE_CATEGORIES}
        transactionsByCategory={MOCK_TXNS_BY_CATEGORY}
        totalExpCat={MOCK_EXPENSE_CATEGORIES.reduce((s, c) => s + c.total, 0)}
        rangeLabel="oct 2025 – jun 2026"
      />

      {/* ConversionPack (instancia real, con datos de ejemplo) */}
      <ConversionPack summary={MOCK_CONVERSION_SUMMARY} />

      {/* EvolucionSuscripciones (instancia real, con datos de ejemplo) */}
      <EvolucionSuscripciones monthly={MOCK_MONTHLY_REVENUE} cohorts={MOCK_COHORTS} />

      {/* ResumenFinanzas (instancia real, con datos de ejemplo) */}
      <ResumenFinanzas
        currentBalance={6746}
        balanceDate="2026-04-10"
        runwayMonths={3.5}
        avgMonthlyBurn={1933}
        completeBurnMonthsCount={3}
        resultadoMes={5169}
        breakEvenGap={-5401}
        avgMonthlyRevenue={9571}
        clientesNecesarios={null}
        curMonthLabel="Junio 2026"
      />

      {/* VolumenBruto (instancia real, con datos de ejemplo) */}
      <VolumenBruto sales={MOCK_SALES} txns={MOCK_TXNS} />

      {/* FuentesIngreso (instancia real, con datos de ejemplo) */}
      <FuentesIngreso
        recurrente={5860}
        puntual={2853}
        totalRev={8713}
        stripeFees={210}
        stripeNet={8502}
        paymentsCount={128}
        activeSubsCount={60}
        periodLabel="21 may – 20 jun 2026"
      />

      {/* EvolucionInscritos (instancia real, con datos de ejemplo) */}
      <EvolucionInscritos payments={MOCK_PAYMENTS} />

      {/* RetencionCohorte (instancia real, con datos de ejemplo) */}
      <RetencionCohorte cohorts={computeRetentionCohorts(MOCK_PAYMENTS, [{ name: "Bàsic", price: 75 }])} />

      {/* IngresosPorProducto (instancia real, con datos de ejemplo) */}
      <IngresosPorProducto
        segments={[
          { item: "Bàsic", revenue: 11100, count: 148, share: 0.46, color: "#6B7ED6" },
          { item: "Plus", revenue: 5600, count: 40, share: 0.23, color: "#9260B8" },
          { item: "Urban", revenue: 2673, count: 243, share: 0.11, color: "#D4AA35" },
          { item: "Pack Benvinguda", revenue: 1900, count: 76, share: 0.08, color: "#4A7A9B" },
          { item: "Pro", revenue: 1080, count: 6, share: 0.04, color: "#4A9870" },
          { item: "Clase suelta", revenue: 880, count: 44, share: 0.04, color: "#D46055" },
          { item: "Otros", revenue: 403, count: 8, share: 0.02, color: "#C46890" },
        ]}
        total={11100 + 5600 + 2673 + 1900 + 1080 + 880 + 403}
        rangeLabel="datos hasta 11/06/2026"
      />

      {/* RunwayDots */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl p-4 sm:p-5">
        <p className="text-sm font-medium text-navy mb-3">Meses de caja</p>
        <div className="flex items-center gap-3">
          <span className="text-xl font-medium text-warning">3,5 m</span>
          <RunwayDots segments={6} value={3.5} tone="warning" />
        </div>
      </div>
    </div>
  );
}
