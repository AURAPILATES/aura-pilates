"use client";

import { useEffect, useState } from "react";

/** Toggle de comparación (temporal): tablas sobre tarjeta blanca (nuevo, por defecto) vs
 * tablas sueltas sobre el fondo (aspecto anterior). El estado vive como clase `tables-flat`
 * en <html> (aplicada sin parpadeo por el script de layout.tsx) y se persiste en localStorage.
 * El switch representa "en tarjeta": activado = tarjeta, desactivado = suelto. */
export default function TableStyleToggle({ className = "" }: { className?: string }) {
  const [boxed, setBoxed] = useState(true);

  useEffect(() => {
    setBoxed(!document.documentElement.classList.contains("tables-flat"));
  }, []);

  function toggle() {
    const next = !boxed;
    setBoxed(next);
    // next = true  -> en tarjeta (quitar tables-flat)
    // next = false -> suelto     (añadir tables-flat)
    document.documentElement.classList.toggle("tables-flat", !next);
    try {
      localStorage.setItem("tablesFlat", next ? "0" : "1");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={boxed}
      aria-label={boxed ? "Mostrar tablas sueltas" : "Mostrar tablas en tarjeta"}
      className={`w-full flex items-center gap-[9px] px-3 py-2.5 rounded-lg text-[13px] font-medium text-navy/55 hover:bg-navy/[0.04] hover:text-navy transition-colors ${className}`}
    >
      <span className="text-navy/40">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="3" y1="15" x2="21" y2="15" />
        </svg>
      </span>
      <span className="flex-1 text-left">Tablas en tarjeta</span>
      <span className={`shrink-0 relative w-9 h-5 rounded-full transition-colors ${boxed ? "bg-primary" : "bg-navy/20"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${boxed ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
