"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Pila de drawers abiertos (puede haber varios apilados, ej. NewContactDrawer sobre
 * TransactionDrawer) - Escape solo debe cerrar el de más arriba, no todos a la vez. Guarda
 * requestClose (dispara la animación de salida), no el onClose real del padre. */
const openDrawers: Array<() => void> = [];

/** Debe coincidir con la duración de .drawer-panel-out/.drawer-veil-out en globals.css: el
 * desmontaje real (onClose del padre) espera a que la animación de salida termine. */
const DRAWER_CLOSE_MS = 180;

/** Si ya se montó un portal de Drawer alguna vez en esta carga de página. El gate
 * mounted/useEffect de abajo existe para el PRIMER portal (evita createPortal(...,
 * document.body) durante el render de servidor, que no tiene document -> mismatch de
 * hidratación). Una vez confirmado que estamos en cliente, un drawer que se remonta (p.ej.
 * key={record.id} al navegar ↑/↓ entre registros) no necesita repetir esa espera de un ciclo
 * de render: sin esto, cada remonte pintaba un frame vacío -> parpadeo visible al navegar. */
let hasMountedPortalBefore = false;

/** Si el Drawer anterior se desmontó de golpe (sin pasar por closing=true, p.ej. al navegar
 * ↑/↓ entre registros con key={record.id}) en vez de cerrarse de verdad, el que lo sustituye
 * no debe repetir la animación de entrada - el panel nunca llegó a irse, solo cambió el
 * contenido. */
let skipNextEnterAnimation = false;

export default function Drawer({
  title,
  subtitle,
  header,
  onClose,
  children,
  footer,
  maxWidth = "max-w-md",
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: {
  title?: string;
  subtitle?: string;
  header?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Puede recibir una función en vez de un nodo directo cuando el footer trae sus propios
   * botones que cierran el drawer (p.ej. "Guardar", "Cancelar"): así también disparan la
   * animación de salida en vez de desmontar al instante saltándose a requestClose. */
  footer?: React.ReactNode | ((close: () => void) => React.ReactNode);
  maxWidth?: string;
  /** Navegar al registro anterior/siguiente de la lista (↑/↓ de teclado). Omitir ambos oculta
   * la caja de flechas - solo aparece cuando el consumidor la pide explícitamente. */
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  // Cerrar no desmonta al instante: marca "closing" (dispara la animación de salida vía
  // clases CSS) y solo entonces, tras DRAWER_CLOSE_MS, llama al onClose real del padre -
  // que es quien de verdad quita el drawer del árbol (p.ej. setSelected(null)).
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => setClosing(true), []);
  const closingRef = useRef(closing);
  closingRef.current = closing;

  // Se lee una sola vez al montar: si el hueco lo dejó un desmontaje abrupto (navegación),
  // este drawer aparece ya "puesto", sin repetir la animación de entrada.
  const [skipEnter] = useState(() => skipNextEnterAnimation);
  useEffect(() => {
    skipNextEnterAnimation = false;
  }, []);

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(onClose, DRAWER_CLOSE_MS);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  useEffect(() => {
    openDrawers.push(requestClose);
    return () => {
      const idx = openDrawers.lastIndexOf(requestClose);
      if (idx !== -1) openDrawers.splice(idx, 1);
      if (!closingRef.current) skipNextEnterAnimation = true;
    };
  }, [requestClose]);

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (openDrawers[openDrawers.length - 1] !== requestClose) return;
      if (ev.key === "Escape") { requestClose(); return; }
      if (!onPrev && !onNext) return;
      // No interceptar flechas si el foco está en un campo editable (inputs de fecha/número
      // dentro del propio drawer, p.ej. tarifas o formularios).
      const el = ev.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (ev.key === "ArrowUp" && hasPrev && onPrev) { ev.preventDefault(); onPrev(); }
      else if (ev.key === "ArrowDown" && hasNext && onNext) { ev.preventDefault(); onNext(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [requestClose, onPrev, onNext, hasPrev, hasNext]);

  // Se monta en <body> para que el `fixed` cubra el viewport aunque el botón que lo abre viva
  // dentro de un contenedor que crea contexto de posicionamiento (p.ej. una cabecera sticky
  // con backdrop-blur, que contendría el fixed y lo dejaría recortado arriba).
  const [mounted, setMounted] = useState(hasMountedPortalBefore);
  useEffect(() => {
    hasMountedPortalBefore = true;
    setMounted(true);
  }, []);

  const overlay = (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className={`absolute inset-0 bg-navy/20 backdrop-blur-[2px] ${closing ? "drawer-veil-out" : skipEnter ? "" : "drawer-veil-in"}`}
        onClick={requestClose}
      />
      <div className={`relative w-full ${maxWidth} bg-card h-full flex flex-col shadow-2xl ${closing ? "drawer-panel-out" : skipEnter ? "" : "drawer-panel-in"}`}>
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-navy/[0.07] shrink-0">
          <div className="min-w-0 flex-1">
            {header ?? (
              <>
                {title && <h2 className="text-base font-bold text-navy truncate">{title}</h2>}
                {subtitle && <p className="text-xs text-navy/45 mt-0.5">{subtitle}</p>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(onPrev || onNext) && (
              <div className="flex items-center rounded-lg border border-navy/[0.12] bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  title="Anterior (↑)"
                  className="w-7 h-7 flex items-center justify-center text-navy/40 hover:text-navy hover:bg-navy/[0.04] disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-default transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <div className="w-px h-4 bg-navy/[0.12]" />
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  title="Siguiente (↓)"
                  className="w-7 h-7 flex items-center justify-center text-navy/40 hover:text-navy hover:bg-navy/[0.04] disabled:opacity-25 disabled:hover:bg-transparent disabled:cursor-default transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            )}
            <button
              onClick={requestClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/40 hover:text-navy transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="border-t border-navy/[0.07] px-6 py-4 shrink-0">
            {typeof footer === "function" ? footer(requestClose) : footer}
          </div>
        )}
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(overlay, document.body);
}
