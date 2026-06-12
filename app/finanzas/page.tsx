import { getEvents } from "@/lib/momence";
import { loadHistoricalEvents } from "@/lib/history";
import { filterPast, filterUpcoming, fmt, occupancyRate, pct } from "@/lib/analytics";
import {
  loadSales,
  salesByMonth,
  salesByMethod,
  salesByProduct,
  totalSalesRevenue,
  revenueForMonth,
} from "@/lib/sales";

export default async function Finanzas() {
  // ── Ingresos reales (CSV Momence) ──────────────────────────────────────────
  const sales = loadSales();
  const hasSales = sales.length > 0;
  const totalRevenue = totalSalesRevenue(sales);
  const mayRevenue = revenueForMonth(sales, "2026-05");
  const junRevenue = revenueForMonth(sales, "2026-06");
  const byMonth = salesByMonth(sales);
  const byMethod = salesByMethod(sales);
  const byProduct = salesByProduct(sales);
  const maxMonthRevenue = Math.max(...byMonth.map((m) => m.revenue), 1);

  const urbanRevenue =
    byMethod.find((m) => m.method === "urban-sports-club")?.revenue ?? 0;
  const urbanPct = totalRevenue > 0 ? urbanRevenue / totalRevenue : 0;

  // ── Ocupación (API Momence) ────────────────────────────────────────────────
  const [liveEvents, historicalEvents] = await Promise.all([
    getEvents(),
    loadHistoricalEvents(),
  ]);
  const allById = new Map(historicalEvents.map((e) => [e.id, e]));
  liveEvents.forEach((e) => allById.set(e.id, e));
  const events = Array.from(allById.values());

  const past30 = filterPast(events, 30);
  const upcoming7 = filterUpcoming(events, 7);
  const past30Students = past30.reduce((s, e) => s + e.ticketsSold, 0);
  const upcoming7Reservas = upcoming7.reduce((s, e) => s + e.ticketsSold, 0);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      <h1 className="text-2xl font-semibold text-stone-900">Finanzas</h1>

      {!hasSales && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          Sin datos de ventas. Copia{" "}
          <code className="font-mono bg-amber-100 px-1 rounded text-xs">
            momence-latest-payments-report-combined.csv
          </code>{" "}
          a{" "}
          <code className="font-mono bg-amber-100 px-1 rounded text-xs">
            data/sales.csv
          </code>
          .
        </div>
      )}

      {/* KPIs reales */}
      <section>
        <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-4">
          Ingresos reales · Momence
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-stone-400 mb-1">Total histórico</p>
            <p className="text-2xl font-semibold text-stone-900">
              {fmt(totalRevenue)}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              {sales.length} transacciones
            </p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-stone-400 mb-1">Mayo 2026</p>
            <p className="text-2xl font-semibold text-stone-900">
              {fmt(mayRevenue)}
            </p>
            <p className="text-xs text-stone-400 mt-1">mes completo</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-stone-400 mb-1">Junio 2026</p>
            <p className="text-2xl font-semibold text-stone-900">
              {fmt(junRevenue)}
            </p>
            <p className="text-xs text-stone-400 mt-1">mes en curso</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-stone-400 mb-1">Urban Sports Club</p>
            <p className="text-2xl font-semibold text-stone-900">
              {pct(urbanPct)}
            </p>
            <p className="text-xs text-stone-400 mt-1">{fmt(urbanRevenue)}</p>
          </div>
        </div>
      </section>

      {/* Gráfico mensual */}
      {byMonth.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-5">
            Ingresos por mes
          </h2>
          <div className="bg-white border border-stone-200 rounded-xl p-6">
            <div className="flex items-end gap-4 h-40">
              {byMonth.map(({ month, label, revenue, count }) => {
                const h = Math.round((revenue / maxMonthRevenue) * 100);
                return (
                  <div
                    key={month}
                    className="flex-1 flex flex-col items-center gap-2 group relative"
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-xs px-2 py-1.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center">
                      <div>{fmt(revenue)}</div>
                      <div className="text-stone-400">{count} transacciones</div>
                    </div>
                    <div
                      className="w-full bg-stone-800 rounded-t hover:bg-stone-600 transition-colors cursor-default"
                      style={{ height: `${Math.max(h, 3)}%` }}
                    />
                    <span className="text-xs text-stone-400">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Canales y productos */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Por canal */}
        <section>
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-4">
            Por canal de pago
          </h2>
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs text-stone-400">
                  <th className="text-left px-5 py-3 font-medium">Canal</th>
                  <th className="text-center px-3 py-3 font-medium">Ventas</th>
                  <th className="text-right px-4 py-3 font-medium">Ingresos</th>
                  <th className="text-right px-5 py-3 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {byMethod.map((row, i) => (
                  <tr
                    key={row.method}
                    className={
                      i < byMethod.length - 1 ? "border-b border-stone-100" : ""
                    }
                  >
                    <td className="px-5 py-3 text-stone-900">{row.label}</td>
                    <td className="px-3 py-3 text-center text-stone-500">
                      {row.count}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-stone-900">
                      {fmt(row.revenue)}
                    </td>
                    <td className="px-5 py-3 text-right text-stone-400">
                      {pct(totalRevenue > 0 ? row.revenue / totalRevenue : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-stone-100 bg-stone-50">
                  <td colSpan={3} className="px-5 py-3 text-xs text-stone-400">
                    Total
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-stone-900">
                    {fmt(totalRevenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* Por producto */}
        <section>
          <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-4">
            Por producto
          </h2>
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs text-stone-400">
                  <th className="text-left px-5 py-3 font-medium">Producto</th>
                  <th className="text-center px-3 py-3 font-medium">Ventas</th>
                  <th className="text-right px-5 py-3 font-medium">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.map((row, i) => (
                  <tr
                    key={row.item}
                    className={
                      i < byProduct.length - 1 ? "border-b border-stone-100" : ""
                    }
                  >
                    <td className="px-5 py-3">
                      <div className="text-stone-900 font-medium">{row.item}</div>
                      <div className="text-xs text-stone-400">{row.category}</div>
                    </td>
                    <td className="px-3 py-3 text-center text-stone-500">
                      {row.count}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-stone-900">
                      {fmt(row.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Ocupación */}
      <section>
        <h2 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-4">
          Ocupación · últimos 30 días
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-stone-400 mb-1">Ocupación media</p>
            <p className="text-2xl font-semibold text-stone-900">
              {pct(occupancyRate(past30))}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              {past30.length} clases impartidas
            </p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-stone-400 mb-1">Alumnos (30 días)</p>
            <p className="text-2xl font-semibold text-stone-900">
              {past30Students}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Media{" "}
              {past30.length > 0
                ? (past30Students / past30.length).toFixed(1)
                : 0}{" "}
              por clase
            </p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs text-stone-400 mb-1">Próximos 7 días</p>
            <p className="text-2xl font-semibold text-stone-900">
              {upcoming7Reservas} reservas
            </p>
            <p className="text-xs text-stone-400 mt-1">
              {upcoming7.length} clases programadas
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
