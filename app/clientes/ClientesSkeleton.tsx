function CardSkeleton() {
  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-5 animate-pulse">
      <div className="h-2 w-16 bg-navy/10 rounded mb-3" />
      <div className="h-2 w-10 bg-navy/[0.07] rounded mb-2" />
      <div className="h-7 w-20 bg-navy/10 rounded mb-2" />
      <div className="h-2 w-24 bg-navy/[0.07] rounded" />
    </div>
  );
}

function LoadingBadge({ text }: { text: string }) {
  return (
    <div className="fixed top-[57px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white text-[11px] rounded-[6px] shadow-lg pointer-events-none">
      <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
      {text}
    </div>
  );
}

export default function ClientesSkeleton() {
  return (
    <div>
      <LoadingBadge text="Obteniendo datos de las integraciones…" />

      {/* 3 trend cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
        {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
      </div>

      {/* 6 KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
        {[0, 1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} />)}
      </div>

      {/* Chart */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-6 mb-4 animate-pulse">
        <div className="h-2.5 w-28 bg-navy/10 rounded mb-1.5" />
        <div className="h-2 w-44 bg-navy/[0.07] rounded mb-5" />
        <div className="h-[180px] bg-navy/[0.05] rounded-xl" />
      </div>

      {/* Retention cohort */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-6 mb-4 animate-pulse">
        <div className="h-2.5 w-36 bg-navy/10 rounded mb-1.5" />
        <div className="h-2 w-52 bg-navy/[0.07] rounded mb-5" />
        <div className="h-[140px] bg-navy/[0.05] rounded-xl" />
      </div>

      {/* Table */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card overflow-hidden animate-pulse">
        <div className="px-4 py-3 border-b border-navy/[0.05] flex items-center gap-3">
          <div className="h-2.5 w-28 bg-navy/10 rounded" />
          <div className="ml-auto h-2.5 w-16 bg-navy/[0.07] rounded" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-4 py-3.5 border-b border-navy/[0.04] last:border-0 flex items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="h-2.5 w-32 bg-navy/10 rounded" />
              <div className="h-2 w-40 bg-navy/[0.07] rounded" />
            </div>
            <div className="ml-auto h-2.5 w-14 bg-navy/[0.07] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
