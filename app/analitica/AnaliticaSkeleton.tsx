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
    <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-navy text-white text-[11px] whitespace-nowrap rounded-[6px] shadow-lg pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse shrink-0" />
        {text}
      </div>
    </div>
  );
}

export default function AnaliticaSkeleton() {
  return (
    <div className="relative">
      <LoadingBadge text="Obteniendo datos de las integraciones…" />

      {/* KPIs principales */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
      </div>

      {/* KPIs secundarios */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
        {[0, 1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
      </div>

      {/* Resumen de pagos */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-5 mb-4 animate-pulse">
        <div className="h-2.5 w-28 bg-navy/10 rounded mb-3" />
        <div className="h-2 bg-navy/[0.06] rounded-full mb-3" />
        <div className="h-2 w-full bg-navy/[0.05] rounded" />
      </div>

      {/* Retention cohort */}
      <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-6 animate-pulse">
        <div className="h-2.5 w-36 bg-navy/10 rounded mb-1.5" />
        <div className="h-2 w-52 bg-navy/[0.07] rounded mb-5" />
        <div className="h-[140px] bg-navy/[0.05] rounded-xl" />
      </div>
    </div>
  );
}
