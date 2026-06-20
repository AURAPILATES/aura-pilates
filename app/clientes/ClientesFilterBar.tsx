"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";

const PRESETS = ["7", "30", "90"] as const;
type Preset = (typeof PRESETS)[number];

function FilterBarInner({ defaultPeriod = "30" }: { defaultPeriod?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const period = sp.get("period") ?? defaultPeriod;
  const compareWith = sp.get("compareWith") ?? "previous";
  const customFrom = sp.get("from") ?? "";
  const customTo = sp.get("to") ?? "";
  const compareFrom = sp.get("compareFrom") ?? "";
  const compareTo = sp.get("compareTo") ?? "";

  const today = new Date().toISOString().split("T")[0];

  function update(changes: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-navy/[0.06]">
      {/* Period preset buttons */}
      <div className="flex items-center gap-0.5 bg-navy/[0.04] rounded-xl p-1">
        {PRESETS.map((d: Preset) => (
          <button
            key={d}
            onClick={() => update({ period: d, from: "", to: "" })}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              period === d ? "bg-white shadow-sm text-navy" : "text-navy/50 hover:text-navy"
            }`}
          >
            {d} días
          </button>
        ))}
        <button
          onClick={() => update({ period: "all", from: "", to: "" })}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            period === "all" ? "bg-white shadow-sm text-navy" : "text-navy/50 hover:text-navy"
          }`}
        >
          Inicio
        </button>
        <button
          onClick={() => update({ period: "custom" })}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            period === "custom" ? "bg-white shadow-sm text-navy" : "text-navy/50 hover:text-navy"
          }`}
        >
          Personalizado
        </button>
      </div>

      {period === "custom" && (
        <div className="flex items-center gap-1.5 bg-white border border-navy/[0.1] rounded-xl px-3 py-1.5">
          <input
            type="date"
            value={customFrom}
            max={customTo || today}
            onChange={(e) => update({ from: e.target.value })}
            className="text-xs text-navy bg-transparent outline-none w-[110px]"
          />
          <span className="text-xs text-navy/30">—</span>
          <input
            type="date"
            value={customTo || today}
            min={customFrom}
            max={today}
            onChange={(e) => update({ to: e.target.value })}
            className="text-xs text-navy bg-transparent outline-none w-[110px]"
          />
        </div>
      )}

      {/* Compare with */}
      <div className="flex items-center gap-2 flex-wrap justify-start sm:ml-auto sm:justify-end">
        <span className="text-[11px] text-navy/40">Comparar con</span>
        <div className="flex items-center gap-0.5 bg-navy/[0.04] rounded-xl p-1">
          <button
            onClick={() => update({ compareWith: "previous", compareFrom: "", compareTo: "" })}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              compareWith === "previous" ? "bg-white shadow-sm text-navy" : "text-navy/50 hover:text-navy"
            }`}
          >
            Período anterior
          </button>
          <button
            onClick={() => update({ compareWith: "custom" })}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              compareWith === "custom" ? "bg-white shadow-sm text-navy" : "text-navy/50 hover:text-navy"
            }`}
          >
            Personalizado
          </button>
        </div>

        {compareWith === "custom" && (
          <div className="flex items-center gap-1.5 bg-white border border-navy/[0.1] rounded-xl px-3 py-1.5">
            <input
              type="date"
              value={compareFrom}
              max={compareTo || today}
              onChange={(e) => update({ compareFrom: e.target.value })}
              className="text-xs text-navy bg-transparent outline-none w-[110px]"
            />
            <span className="text-xs text-navy/30">—</span>
            <input
              type="date"
              value={compareTo || today}
              min={compareFrom}
              max={today}
              onChange={(e) => update({ compareTo: e.target.value })}
              className="text-xs text-navy bg-transparent outline-none w-[110px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientesFilterBar({ defaultPeriod }: { defaultPeriod?: string }) {
  return (
    <Suspense fallback={<div className="h-10 mb-4" />}>
      <FilterBarInner defaultPeriod={defaultPeriod} />
    </Suspense>
  );
}
