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

function RowSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-navy/[0.04] last:border-0 flex items-center gap-4">
      <div className="w-8 h-8 rounded-full bg-navy/[0.08] shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="h-2.5 w-32 bg-navy/10 rounded" />
        <div className="h-2 w-40 bg-navy/[0.07] rounded" />
      </div>
      <div className="hidden sm:block h-2.5 w-16 bg-navy/[0.07] rounded" />
      <div className="flex flex-col items-end gap-1.5 w-20 shrink-0">
        <div className="h-2.5 w-14 bg-navy/10 rounded" />
        <div className="h-2 w-10 bg-navy/[0.07] rounded" />
      </div>
      <div className="hidden sm:block h-2.5 w-14 bg-navy/[0.07] rounded shrink-0" />
      <div className="h-5 w-24 bg-navy/[0.06] rounded-full shrink-0" />
    </div>
  );
}

export default function ClientesSkeleton() {
  return (
    <div className="relative">
      <LoadingBadge text="Obteniendo datos de las integraciones…" />

      <div className="animate-pulse">
        {/* Section tabs */}
        <div className="flex items-center gap-1 border-b border-navy/[0.08] pb-2 mb-5">
          <div className="h-7 w-32 bg-navy/[0.08] rounded-lg" />
          <div className="h-7 w-36 bg-navy/[0.04] rounded-lg" />
        </div>

        {/* Toolbar: search + CSV + filter pills */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="flex-1 h-[38px] bg-card border border-navy/[0.1] rounded-xl" />
            <div className="w-9 h-9 bg-card border border-navy/[0.1] rounded-xl shrink-0" />
          </div>
          <div className="h-9 w-64 bg-card border border-navy/[0.1] rounded-xl" />
        </div>

        {/* Table */}
        <div className="bg-card border border-navy/[0.07] shadow-card rounded-[5px] overflow-hidden">
          <div className="px-4 py-3 border-b border-navy/[0.06] flex items-center gap-4">
            <div className="h-2.5 w-16 bg-navy/10 rounded flex-1 max-w-[130px]" />
            <div className="h-2.5 w-10 bg-navy/10 rounded" />
            <div className="hidden sm:block h-2.5 w-10 bg-navy/10 rounded" />
            <div className="ml-auto h-2.5 w-14 bg-navy/10 rounded" />
          </div>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <RowSkeleton key={i} />
          ))}
          <div className="flex items-center justify-between px-4 py-3 border-t border-navy/[0.06]">
            <div className="h-2.5 w-24 bg-navy/[0.07] rounded" />
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => <div key={i} className="w-7 h-7 bg-navy/[0.05] rounded-md" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
