"use client";

/** Muestra/oculta la sidebar de escritorio. El estado vive como clase `nav-hidden` en
 * <html> (aplicada sin parpadeo por un script inline en layout.tsx) y se persiste en
 * localStorage. Dos botones comparten la acción: uno dentro de la sidebar para ocultarla
 * y otro flotante (visible solo cuando está oculta, vía CSS) para volver a mostrarla. */
function toggleNav() {
  const hidden = document.documentElement.classList.toggle("nav-hidden");
  try {
    localStorage.setItem("navHidden", hidden ? "1" : "0");
  } catch {
    /* localStorage no disponible: el toggle sigue funcionando en la sesión actual */
  }
}

/** Botón dentro de la sidebar para ocultarla (chevron hacia la izquierda). */
export function HideNavButton() {
  return (
    <button
      type="button"
      onClick={toggleNav}
      title="Ocultar menú"
      aria-label="Ocultar menú"
      className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-navy/40 hover:text-navy hover:bg-navy/[0.05] transition-colors"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 6l-6 6 6 6" />
        <line x1="4" y1="5" x2="4" y2="19" />
      </svg>
    </button>
  );
}

/** Botón para volver a mostrar la sidebar. Va integrado en la cabecera de cada página (a la
 * izquierda, misma altura que el logo/título), no flotante — así aparece siempre en el mismo
 * sitio. Solo visible cuando la sidebar está oculta y en escritorio (reglas .nav-reopen en
 * globals.css); en móvil manda el menú hamburguesa. */
export function ShowNavButton() {
  return (
    <button
      type="button"
      onClick={toggleNav}
      title="Mostrar menú"
      aria-label="Mostrar menú"
      className="nav-reopen shrink-0 items-center gap-1.5 h-9 pl-2.5 pr-3 rounded-lg border border-navy/[0.1] bg-card shadow-sm text-[13px] font-medium text-navy/75 hover:text-navy hover:bg-navy/[0.03] transition-colors"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
      Menú
    </button>
  );
}
