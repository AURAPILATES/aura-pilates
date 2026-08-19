"use client";

import { useState, useRef, useEffect } from "react";

/** Icono ⓘ que muestra un texto de ayuda. En escritorio (dispositivo con ratón) se abre al
 * pasar el cursor por encima; en móvil/táctil se abre al tocar. El popover se posiciona con
 * position:fixed a partir del icono, así no lo recorta ningún contenedor con overflow-hidden
 * (p.ej. ChartCard).
 *
 * Raíz <span role="button"> a propósito, NUNCA <button>: InfoDot se incrusta a menudo dentro de
 * otros elementos clicables (StatBox, filas de tabla...) y un <button> real dentro de otro
 * <button> es HTML inválido - el navegador reordena el DOM al parsear, lo que React detecta
 * como error de hidratación (ver StatBox en ClientesEstado.tsx/AnaliticaKPIs.tsx, que ya causó
 * este bug dos veces). Con <span> + role/tabIndex/onKeyDown, InfoDot es seguro de anidar en
 * cualquier contexto sin que quien lo use tenga que acordarse de nada. */
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
  const [canHover, setCanHover] = useState(false);
  const btnRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setCanHover(typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches);
  }, []);

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

  function computePos(): { top: number; left: number; below: boolean } {
    const r = btnRef.current!.getBoundingClientRect();
    const maxLeft = (typeof window !== "undefined" ? window.innerWidth : r.left + 216) - 216;
    const left = Math.max(8, Math.min(r.left, maxLeft));
    const below = r.top < 120; // poco espacio arriba → mostrar debajo del icono
    return { top: below ? r.bottom + 8 : r.top - 8, left, below };
  }

  return (
    <>
      <span
        ref={btnRef}
        role="button"
        tabIndex={0}
        aria-label="Más información"
        onMouseEnter={() => { if (canHover) setPos(computePos()); }}
        onMouseLeave={() => { if (canHover) setPos(null); }}
        onClick={(e) => {
          e.stopPropagation();
          if (!canHover) setPos((p) => (p ? null : computePos()));
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          setPos((p) => (p ? null : computePos()));
        }}
        className={`shrink-0 inline-flex cursor-pointer text-navy/35 hover:text-navy/55 transition-colors ${className}`}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </span>
      {pos && (
        <div
          className={`fixed z-50 w-52 bg-navy-solid text-white text-[11px] leading-relaxed rounded-xl px-3 py-2.5 shadow-xl normal-case tracking-normal font-normal pointer-events-none ${pos.below ? "" : "-translate-y-full"}`}
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
