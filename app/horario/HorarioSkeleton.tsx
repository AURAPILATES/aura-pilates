import MobileNav from "@/app/components/MobileNav";

export default function HorarioSkeleton() {
  const chevLeft  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>;
  const chevRight = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>;

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-app-bg/95 backdrop-blur-sm border-b border-navy/[0.06]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[45px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MobileNav />
            <span className="text-sm font-bold text-navy uppercase tracking-widest">Horario</span>
            <div className="hidden sm:flex items-center border border-navy/[0.12] rounded-lg bg-card p-0.5 gap-0.5 animate-pulse">
              <div className="w-16 h-6 rounded-md bg-navy/10" />
              <div className="w-16 h-6 rounded-md bg-navy/[0.04]" />
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 animate-pulse">
            <div className="w-7 h-7 flex items-center justify-center rounded-md border border-navy/[0.12] bg-card text-navy/20">
              {chevLeft}
            </div>
            <div className="w-[110px] h-3 rounded bg-navy/[0.08]" />
            <div className="w-7 h-7 flex items-center justify-center rounded-md border border-navy/[0.12] bg-card text-navy/20">
              {chevRight}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 pt-6 pb-16">

        <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-solid text-white text-[11px] whitespace-nowrap rounded-[6px] shadow-lg pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse shrink-0" />
            Obteniendo datos de Momence…
          </div>
        </div>

        <div className="animate-pulse">

        {/* Stat cards - desktop */}
        <div className="hidden sm:grid grid-cols-4 gap-3 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-navy/[0.07] rounded-2xl shadow-card px-5 py-4">
              <div className="h-2 w-14 bg-navy/[0.07] rounded mb-3" />
              <div className="h-9 w-10 bg-navy/10 rounded" />
            </div>
          ))}
        </div>

        {/* Stat card - mobile */}
        <div className="sm:hidden bg-card border border-navy/[0.07] rounded-2xl shadow-card mb-5 overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <div className="h-12 w-20 bg-navy/10 rounded mb-1" />
          </div>
          <div className="border-t border-navy/[0.06] grid grid-cols-3 divide-x divide-navy/[0.06]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="px-4 py-3">
                <div className="h-2 w-12 bg-navy/[0.07] rounded mb-2" />
                <div className="h-5 w-8 bg-navy/10 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Filter bar - desktop */}
        <div className="hidden sm:flex items-center gap-3 mb-6">
          <div className="h-9 w-40 bg-card border border-navy/[0.1] rounded-lg" />
          <div className="h-9 w-48 bg-card border border-navy/[0.1] rounded-lg" />
          <div className="h-9 w-64 bg-card border border-navy/[0.12] rounded-lg" />
        </div>

        {/* Class list rows */}
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card border border-navy/[0.07] rounded-2xl shadow-card px-5 py-4 flex items-center gap-4">
              <div className="w-12 h-3.5 bg-navy/[0.08] rounded shrink-0" />
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="h-3.5 w-36 bg-navy/10 rounded" />
                <div className="h-2.5 w-24 bg-navy/[0.07] rounded" />
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <div className="h-3 w-12 bg-navy/[0.08] rounded" />
                <div className="h-1.5 w-20 bg-navy/[0.05] rounded-full" />
              </div>
            </div>
          ))}
        </div>

        </div>
      </div>
    </div>
  );
}
