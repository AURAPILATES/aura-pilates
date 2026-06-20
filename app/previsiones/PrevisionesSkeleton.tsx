export default function PrevisionesSkeleton() {
  return (
    <div>
      <div className="fixed top-[57px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white text-[11px] rounded-[6px] shadow-lg pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
        Obteniendo datos de Stripe y Momence…
      </div>

      <div className="animate-pulse">
        {/* Scenario cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`rounded-xl border p-3 sm:p-4 ${i === 0 ? "border-primary/30 bg-primary/[0.04]" : "border-navy/[0.08] bg-white"}`}>
              <div className="h-3 w-20 bg-navy/10 rounded mb-1.5" />
              <div className="h-2 w-28 bg-navy/[0.07] rounded mb-3" />
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-2 w-16 bg-navy/[0.06] rounded" />
                  <div className="h-2 w-8 bg-navy/10 rounded" />
                </div>
                <div className="flex justify-between">
                  <div className="h-2 w-20 bg-navy/[0.06] rounded" />
                  <div className="h-2 w-8 bg-navy/10 rounded" />
                </div>
                <div className="flex justify-between">
                  <div className="h-2 w-16 bg-navy/[0.06] rounded" />
                  <div className="h-2 w-10 bg-navy/10 rounded" />
                </div>
                <div className="pt-1 border-t border-navy/[0.06] flex justify-between">
                  <div className="h-2 w-14 bg-navy/[0.06] rounded" />
                  <div className="h-2 w-12 bg-navy/10 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-6 mb-4">
          <div className="h-2.5 w-32 bg-navy/10 rounded mb-1.5" />
          <div className="h-2 w-48 bg-navy/[0.07] rounded mb-5" />
          <div className="h-20 bg-navy/[0.05] rounded-xl" />
        </div>

        {/* Params / knobs row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4">
              <div className="h-2 w-20 bg-navy/[0.07] rounded mb-3" />
              <div className="h-8 w-full bg-navy/[0.05] rounded-lg" />
            </div>
          ))}
        </div>

        {/* Forecast table */}
        <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-navy/[0.05] flex gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-2.5 bg-navy/10 rounded" style={{ width: `${[48, 60, 56, 56, 48][i]}px` }} />
            ))}
          </div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-4 py-3 border-b border-navy/[0.04] last:border-0 flex items-center gap-4">
              <div className="h-2.5 w-12 bg-navy/10 rounded" />
              <div className="h-2.5 w-16 bg-navy/[0.07] rounded" />
              <div className="h-2.5 w-16 bg-navy/[0.07] rounded" />
              <div className="h-2.5 w-16 bg-navy/[0.07] rounded" />
              <div className="h-2.5 w-14 bg-navy/10 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
