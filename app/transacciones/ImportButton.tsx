"use client";
import { useState, useRef, useEffect } from "react";
import ImportModal from "./ImportModal";
import Button from "@/app/components/Button";

export default function ImportButton({
  className = "",
  onManual,
  compact = false,
}: {
  className?: string;
  onManual?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      <div ref={ref} className={`relative ${className}`}>
        {compact ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center justify-center gap-1.5 px-3 h-9 bg-white text-navy text-[13px] font-medium border border-navy/15 rounded-xl hover:bg-navy/[0.02] transition-colors w-full"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Añadir movimiento
          </button>
        ) : (
          <Button onClick={() => setOpen((v) => !v)} className="flex items-center justify-center gap-2 w-full">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Añadir movimiento
          </Button>
        )}

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-navy/[0.1] rounded-xl shadow-lg z-50 overflow-hidden">
            <button
              onClick={() => { setShowImport(true); setOpen(false); }}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-navy/[0.03] transition-colors text-left"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-navy/50">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div>
                <p className="text-sm font-medium text-navy">Importar documento</p>
                <p className="text-xs text-navy/45 mt-0.5">Sube el CSV del banco</p>
              </div>
            </button>
            <div className="border-t border-navy/[0.06]" />
            <button
              onClick={() => { onManual?.(); setOpen(false); }}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-navy/[0.03] transition-colors text-left"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-navy/50">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              <div>
                <p className="text-sm font-medium text-navy">Crear registro a mano</p>
                <p className="text-xs text-navy/45 mt-0.5">Añade un movimiento de efectivo u otro origen</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </>
  );
}
