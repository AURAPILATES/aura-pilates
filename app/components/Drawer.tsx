"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Pila de drawers abiertos (puede haber varios apilados, ej. NewContactDrawer sobre
 * TransactionDrawer) - Escape solo debe cerrar el de más arriba, no todos a la vez. */
const openDrawers: Array<() => void> = [];

export default function Drawer({
  title,
  subtitle,
  header,
  onClose,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  title?: string;
  subtitle?: string;
  header?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    openDrawers.push(onClose);
    return () => {
      const idx = openDrawers.lastIndexOf(onClose);
      if (idx !== -1) openDrawers.splice(idx, 1);
    };
  }, [onClose]);

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && openDrawers[openDrawers.length - 1] === onClose) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Se monta en <body> para que el `fixed` cubra el viewport aunque el botón que lo abre viva
  // dentro de un contenedor que crea contexto de posicionamiento (p.ej. una cabecera sticky
  // con backdrop-blur, que contendría el fixed y lo dejaría recortado arriba).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const overlay = (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${maxWidth} bg-card h-full flex flex-col shadow-2xl`}>
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-navy/[0.07] shrink-0">
          <div className="min-w-0 flex-1">
            {header ?? (
              <>
                {title && <h2 className="text-base font-bold text-navy truncate">{title}</h2>}
                {subtitle && <p className="text-xs text-navy/45 mt-0.5">{subtitle}</p>}
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-navy/5 text-navy/40 hover:text-navy transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-navy/[0.07] px-6 py-4 shrink-0">{footer}</div>}
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(overlay, document.body);
}
