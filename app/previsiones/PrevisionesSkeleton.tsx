export default function PrevisionesSkeleton() {
  return (
    <div>
      {/* Toolbar: caption + selector de período */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="h-3 w-64 bg-navy/[0.07] rounded animate-pulse" />
        <div className="h-8 w-[220px] bg-subtle rounded-[10px] animate-pulse" />
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-[14px] overflow-hidden animate-pulse">
        {/* Cabecera de meses */}
        <div className="flex gap-4 px-4 py-3 border-b border-border">
          <div className="h-2.5 w-32 bg-navy/[0.06] rounded shrink-0" />
          <div className="flex gap-6 ml-auto">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-2.5 w-10 bg-navy/[0.06] rounded" />
            ))}
          </div>
        </div>
        {/* Filas */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-2.5 border-b border-subtle last:border-0">
            <div className={`h-2.5 rounded shrink-0 ${i === 1 || i === 4 ? "w-24 bg-navy/12" : "w-32 bg-navy/[0.06]"}`} />
            <div className="flex gap-6 ml-auto">
              {[0, 1, 2, 3, 4, 5].map((j) => (
                <div key={j} className={`h-2.5 w-10 rounded ${i === 1 || i === 4 ? "bg-navy/10" : "bg-navy/[0.05]"}`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
