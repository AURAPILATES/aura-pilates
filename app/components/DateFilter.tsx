"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/dateRange";
import Button from "@/app/components/Button";

export default function DateFilter() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const current      = (searchParams.get("range") ?? "all") as RangeKey;
  const urlFrom      = searchParams.get("from") ?? "";
  const urlTo        = searchParams.get("to") ?? "";

  const [open, setOpen]             = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [fromVal, setFromVal]       = useState(urlFrom);
  const [toVal, setToVal]           = useState(urlTo);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setFromVal(urlFrom);
    setToVal(urlTo);
  }, [urlFrom, urlTo]);

  const currentLabel =
    current === "custom"
      ? "Personalizado"
      : (RANGE_OPTIONS.find((o) => o.key === current)?.label ?? "Desde el inicio");

  function selectRange(key: RangeKey) {
    if (key === "custom") {
      setShowCustom(true);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    if (key === "all") {
      params.delete("range");
    } else {
      params.set("range", key);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
    setOpen(false);
  }

  function applyCustom() {
    if (!fromVal && !toVal) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", "custom");
    if (fromVal) params.set("from", fromVal); else params.delete("from");
    if (toVal)   params.set("to", toVal);     else params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
    setShowCustom(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) setShowCustom(current === "custom");
        }}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-navy/[0.12] rounded-xl bg-white text-navy hover:bg-navy/[0.03] transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>{currentLabel}</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-navy/[0.12] rounded-xl shadow-lg overflow-hidden min-w-[210px]">
          {!showCustom ? (
            <ul className="py-1">
              {RANGE_OPTIONS.map(({ key, label }) => (
                <li key={key}>
                  <button
                    onClick={() => selectRange(key)}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      current === key
                        ? "bg-primary/[0.08] text-primary font-medium"
                        : "text-navy/70 hover:bg-navy/[0.04] hover:text-navy"
                    }`}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 space-y-3">
              <p className="text-[11px] font-semibold text-navy/45 uppercase tracking-wide">
                Rango personalizado
              </p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-navy/50 mb-1 block">Desde</label>
                  <input
                    type="date"
                    value={fromVal}
                    onChange={(e) => setFromVal(e.target.value)}
                    className="w-full text-sm border border-navy/[0.15] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
                  />
                </div>
                <div>
                  <label className="text-xs text-navy/50 mb-1 block">Hasta</label>
                  <input
                    type="date"
                    value={toVal}
                    onChange={(e) => setToVal(e.target.value)}
                    className="w-full text-sm border border-navy/[0.15] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30 text-navy"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowCustom(false)}
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-navy/[0.12] text-navy/60 hover:bg-navy/[0.03] transition-colors"
                >
                  Volver
                </button>
                <Button onClick={applyCustom} disabled={!fromVal && !toVal} className="flex-1">
                  Aplicar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
