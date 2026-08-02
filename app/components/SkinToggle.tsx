"use client";

import { useEffect, useState } from "react";

/** Toggle de comparación (temporal): paleta "editorial" (cálida, por defecto) vs
 * "precision" (fría, tipo SaaS). El estado vive como atributo `data-skin` en <html>
 * (aplicado sin parpadeo por el script de layout.tsx) y se persiste en localStorage.
 * Por ahora solo cambia sidebar + fondo general, mientras se decide cuál se queda. */
export default function SkinToggle({ className = "" }: { className?: string }) {
  const [precision, setPrecision] = useState(false);

  useEffect(() => {
    setPrecision(document.documentElement.getAttribute("data-skin") === "precision");
  }, []);

  function toggle() {
    const next = !precision;
    setPrecision(next);
    if (next) {
      document.documentElement.setAttribute("data-skin", "precision");
    } else {
      document.documentElement.removeAttribute("data-skin");
    }
    try {
      localStorage.setItem("skin", next ? "precision" : "editorial");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={precision}
      aria-label={precision ? "Cambiar a paleta editorial" : "Cambiar a paleta precision"}
      title="Paleta"
      className={`nav-row w-full flex items-center gap-[9px] px-3 py-2.5 rounded-lg text-[13px] font-medium text-navy/55 hover:bg-navy/[0.04] hover:text-navy transition-colors ${className}`}
    >
      <span className="text-navy/40">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.7 1.5-1.5 0-.4-.1-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.4-4.5-8-10-8z" />
        </svg>
      </span>
      <span className="nav-label flex-1 text-left">Paleta {precision ? "precision" : "editorial"}</span>
      <span className="nav-rail-hide shrink-0 relative w-9 h-5 rounded-full transition-colors bg-navy/20">
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${precision ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
