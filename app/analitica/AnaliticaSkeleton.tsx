type Tab = "ingresosGastos" | "clientes";

function LoadingBadge({ text }: { text: string }) {
  return (
    <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-solid text-white text-[11px] whitespace-nowrap rounded-[6px] shadow-lg pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse shrink-0" />
        {text}
      </div>
    </div>
  );
}

function SectionTitleSkeleton() {
  return <div className="h-2.5 w-40 bg-navy/10 rounded mb-5" />;
}

function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-[14px] p-4">
          <div className="h-2 w-16 bg-navy/10 rounded mb-3" />
          <div className="h-6 w-20 bg-navy/10 rounded mb-2" />
          <div className="h-2 w-14 bg-navy/[0.07] rounded" />
        </div>
      ))}
    </div>
  );
}

/** Forma genérica de ChartCard: título + rango, fila de KPIs opcional, y cuerpo (gráfico,
 * lista o gráfico+resumen a dos columnas) - reutilizada para casi todas las secciones. */
function ChartCardSkeleton({
  bodyHeight = "h-[180px]",
  kpis = 1,
  twoCol = false,
}: {
  bodyHeight?: string;
  kpis?: number;
  twoCol?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-[14px] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="h-3 w-36 bg-navy/10 rounded" />
        <div className="h-4 w-16 bg-navy/[0.06] rounded-full shrink-0" />
      </div>
      <div className="h-2 w-52 bg-navy/[0.06] rounded mb-4" />
      {kpis > 0 && (
        <div className="flex gap-6 mb-4 pb-3.5 border-b border-border">
          {Array.from({ length: kpis }).map((_, i) => (
            <div key={i}>
              <div className="h-2 w-14 bg-navy/[0.07] rounded mb-1.5" />
              <div className="h-5 w-16 bg-navy/10 rounded" />
            </div>
          ))}
        </div>
      )}
      {twoCol ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className={`lg:col-span-2 ${bodyHeight} bg-navy/[0.05] rounded-[10px]`} />
          <div className="lg:col-span-1 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-6 bg-navy/[0.05] rounded-lg" />)}
          </div>
        </div>
      ) : (
        <div className={`${bodyHeight} bg-navy/[0.05] rounded-[10px]`} />
      )}
    </div>
  );
}

function TableCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-card border border-border rounded-[14px] p-4 sm:p-5">
      <div className="h-3 w-40 bg-navy/10 rounded mb-1.5" />
      <div className="h-2 w-56 bg-navy/[0.06] rounded mb-4" />
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-2.5 flex-1 bg-navy/[0.06] rounded" />
            <div className="h-2.5 w-14 bg-navy/[0.06] rounded" />
            <div className="h-2.5 w-14 bg-navy/[0.06] rounded" />
            <div className="h-2.5 w-14 bg-navy/[0.06] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ingresos y gastos: Volumen bruto, Ventas por, Desglose de gastos (gráfico + resumen),
 * Gasto por origen, Previsión de gastos, Financiación, Breakeven, IVA/IRPF aproximados. */
function IngresosGastosSkeleton() {
  return (
    <div className="space-y-4">
      <SectionTitleSkeleton />
      <ChartCardSkeleton kpis={2} bodyHeight="h-[200px]" />
      <ChartCardSkeleton kpis={3} bodyHeight="h-[200px]" />
      <ChartCardSkeleton kpis={1} bodyHeight="h-[220px]" twoCol />
      <ChartCardSkeleton kpis={1} bodyHeight="h-[150px]" />
      <TableCardSkeleton rows={4} />
      <ChartCardSkeleton kpis={2} bodyHeight="h-[130px]" />
      <ChartCardSkeleton kpis={2} bodyHeight="h-[180px]" />
      <TableCardSkeleton rows={3} />
    </div>
  );
}

/** Clientes: KPIs, Evolución de inscritos, Horario, Primera compra + Desglose de pagos (dos
 * columnas), Conversión de pack, Retención por cohorte. */
function ClientesTabSkeleton() {
  return (
    <div className="space-y-4">
      <SectionTitleSkeleton />
      <KpiRowSkeleton count={4} />
      <ChartCardSkeleton kpis={0} bodyHeight="h-[180px]" />
      <ChartCardSkeleton kpis={0} bodyHeight="h-[220px]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChartCardSkeleton kpis={0} bodyHeight="h-[140px]" />
        <ChartCardSkeleton kpis={0} bodyHeight="h-[140px]" />
      </div>
      <ChartCardSkeleton kpis={1} bodyHeight="h-[160px]" />
      <TableCardSkeleton rows={4} />
    </div>
  );
}

/** Refleja la pestaña activa (Ingresos y gastos / Clientes) para que el esqueleto se parezca al
 * contenido real que va a cargar, en vez de un bloque genérico repetido - `tab` viene resuelto
 * en el servidor desde el searchParam, igual que AnaliticaTabProvider. */
export default function AnaliticaSkeleton({ tab = "ingresosGastos" }: { tab?: Tab }) {
  return (
    <div className="relative animate-pulse">
      <LoadingBadge text="Obteniendo datos de las integraciones…" />
      {tab === "clientes" ? <ClientesTabSkeleton /> : <IngresosGastosSkeleton />}
    </div>
  );
}
