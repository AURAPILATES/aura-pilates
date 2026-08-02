"use client";

import { useEffect, useState } from "react";

/** Switch claro/oscuro. Lee el estado real del <html> tras montar (ya aplicado
 * por el script anti-flash en layout.tsx) y persiste el cambio en localStorage. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title="Modo oscuro"
      className={`nav-row w-full flex items-center gap-[9px] px-3 py-2.5 rounded-lg text-[13px] font-medium text-navy/55 hover:bg-navy/[0.04] hover:text-navy transition-colors ${className}`}
    >
      <span className="text-navy/40">
        {dark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
          </svg>
        )}
      </span>
      <span className="nav-label flex-1 text-left">Modo oscuro</span>
      <span className={`nav-rail-hide shrink-0 relative w-9 h-5 rounded-full transition-colors ${dark ? "bg-primary" : "bg-navy/20"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${dark ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
