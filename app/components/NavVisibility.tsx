"use client";

import { useEffect, useState } from "react";

/** Colapsa/expande la sidebar de escritorio a modo "rail" (solo iconos, sin texto).
 * El estado vive como clase `nav-rail` en <html> (aplicada sin parpadeo por un script
 * inline en layout.tsx) y se persiste en localStorage. A diferencia del ocultado total
 * anterior, la barra se queda siempre visible y navegable, solo cambia de ancho. */
function setRail(next: boolean) {
  document.documentElement.classList.toggle("nav-rail", next);
  try {
    localStorage.setItem("navRail", next ? "1" : "0");
  } catch {
    /* localStorage no disponible: el toggle sigue funcionando en la sesión actual */
  }
}

/** Botón dentro de la sidebar que colapsa/expande el menú. Vive siempre en el mismo
 * sitio (junto al logo, o solo mientras eso es visible en modo rail); el icono gira
 * según el estado. */
export function ToggleNavButton() {
  const [rail, setRailState] = useState(false);

  useEffect(() => {
    setRailState(document.documentElement.classList.contains("nav-rail"));
  }, []);

  function toggle() {
    const next = !rail;
    setRailState(next);
    setRail(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={rail ? "Expandir menú" : "Colapsar menú"}
      aria-label={rail ? "Expandir menú" : "Colapsar menú"}
      className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-navy/40 hover:text-navy hover:bg-navy/[0.05] transition-colors"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-transform ${rail ? "rotate-180" : ""}`}
      >
        <path d="M15 6l-6 6 6 6" />
        <line x1="4" y1="5" x2="4" y2="19" />
      </svg>
    </button>
  );
}
