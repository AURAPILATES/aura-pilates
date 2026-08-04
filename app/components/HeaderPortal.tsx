"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Porta contenido al hueco #header-actions (botón primario, p. ej. "Añadir movimiento") o
 * #header-tabs (SectionTabsV2) del header sticky de la página. El header vive en el server
 * component (page.tsx), sin padding lateral para que sus líneas divisorias lleguen a los
 * bordes reales de la tarjeta; el contenido portado vive donde está su lógica real (modales,
 * estado de pestañas…), a menudo varios niveles más abajo en el árbol cliente. El portal evita
 * tener que subir ese estado. */
export default function HeaderPortal({ children, target: targetId = "header-actions" }: { children: React.ReactNode; target?: "header-actions" | "header-tabs" }) {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    setTarget(document.getElementById(targetId));
  }, [targetId]);

  if (!target) return null;
  return createPortal(children, target);
}
