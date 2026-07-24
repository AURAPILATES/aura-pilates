"use client";

import { useState, useRef, useEffect } from "react";

/** Icono ⓘ que muestra un texto de ayuda al tocar/clicar (no al hover), para que también
 * funcione en móvil donde no hay hover. El popover se posiciona con position:fixed a partir
 * del icono, así no lo recorta ningún contenedor con overflow-hidden (p.ej. ChartCard). */
export default function InfoDot({
  text,
  size = 12,
  className = "",
}: {
  text: string;
  size?: number;
  className?: string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDocClick = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setPos(null);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("click", onDocClick);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("click", onDocClick);
    };
  }, [pos]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (pos) { setPos(null); return; }
    const r = btnRef.current!.getBoundingClientRect();
    const maxLeft = (typeof window !== "undefined" ? window.innerWidth : r.left + 216) - 216;
    const left = Math.max(8, Math.min(r.left, maxLeft));
    const below = r.top < 120; // poco espacio arriba → mostrar debajo del icono
    setPos({ top: below ? r.bottom + 8 : r.top - 8, left, below });
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Más información"
        className={`shrink-0 text-navy/35 hover:text-navy/55 transition-colors ${className}`}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
      {pos && (
        <div
          className={`fixed z-50 w-52 bg-navy-solid text-white text-[11px] leading-relaxed rounded-xl px-3 py-2.5 shadow-xl normal-case tracking-normal font-normal ${pos.below ? "" : "-translate-y-full"}`}
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
          {pos.below ? (
            <div className="absolute bottom-full left-3 border-4 border-transparent border-b-navy" />
          ) : (
            <div className="absolute top-full left-3 border-4 border-transparent border-t-navy" />
          )}
        </div>
      )}
    </>
  );
}
