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

function ChartSkeleton({ height = "h-[180px]" }: { height?: string }) {
  return (
    <div className="bg-white border border-navy/[0.07] rounded-2xl shadow-card p-4 sm:p-6 animate-pulse">
      <div className="h-2.5 w-28 bg-navy/10 rounded mb-1.5" />
      <div className="h-2 w-44 bg-navy/[0.07] rounded mb-5" />
      <div className={`${height} bg-navy/[0.05] rounded-xl`} />
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

function SectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-3 w-44 bg-navy/10 rounded mb-1 animate-pulse" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
      </div>
      <ChartSkeleton />
    </div>
  );
}

export default function AnaliticaSkeleton() {
  return (
    <div className="relative">
      <LoadingBadge text="Obteniendo datos de las integraciones…" />

      <div className="space-y-14">
        {[0, 1, 2, 3, 4].map((section) => <SectionSkeleton key={section} />)}
      </div>
    </div>
  );
}
