"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

/** Barra de búsqueda del rediseño en prueba - misma API que SearchInput.tsx, otro look.
 * ⌘K (Ctrl+K en Windows/Linux) enfoca el campo desde cualquier punto de la página. Si hay
 * varias instancias montadas a la vez (p. ej. pestañas ocultas vía CSS), cada una comprueba
 * su propia visibilidad (offsetParent) para no robarle el foco a un campo oculto. */
export default function SearchInputV2({ value, onChange, placeholder = "Buscar…", className = "" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      const el = inputRef.current;
      if (!el || el.offsetParent === null) return;
      e.preventDefault();
      el.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.8-3.8"/>
      </svg>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-9 py-2.5 text-[13.5px] border border-border rounded-[10px] bg-card text-navy placeholder:text-faint outline-none focus:ring-2 focus:ring-navy/10 focus:border-navy/30 transition"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors"
        >
          ✕
        </button>
      ) : (
        <span className="hidden sm:flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center gap-px pointer-events-none text-[10.5px] font-medium text-faint bg-subtle border border-border rounded-[5px] px-1.5 py-0.5">
          ⌘K
        </span>
      )}
    </div>
  );
}
