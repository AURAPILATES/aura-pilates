"use client";

import { useEffect, useState } from "react";

// Banner fijo que avisa cuando la integración v2 de Momence está caída.
// Consulta /api/momence-v2-health al montar y cada 5 min. Solo se muestra si
// la integración responde "desconectada" (no ante fallos de red del propio
// health, para evitar falsos positivos). El caso típico: cambio de contraseña
// en Momence -> hay que actualizar MOMENCE_PASSWORD en .env.local y en Vercel.
export default function MomenceV2Banner() {
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/momence-v2-health", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setDisconnected(data?.connected === false);
      } catch {
        // Fallo de red al consultar el health: no mostramos banner (falso positivo).
      }
    }

    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!disconnected) return null;

  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-[100] bg-amber-500 dark:bg-amber-600 text-amber-950 dark:text-amber-50 shadow-md"
    >
      <div className="mx-auto max-w-5xl px-4 py-2.5 flex items-start gap-2.5 text-[13px] leading-snug">
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 mt-0.5"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p>
          <span className="font-semibold">Integración con Momence desconectada.</span>{" "}
          Si es por un cambio de contraseña en Momence, dile a Julia que introduzca la nueva
          contraseña en{" "}
          <code className="rounded bg-amber-950/15 dark:bg-amber-50/15 px-1 py-0.5 font-mono text-[12px]">
            .env.local
          </code>{" "}
          y en{" "}
          <span className="font-semibold">Vercel → Environment Variables</span>.
        </p>
      </div>
    </div>
  );
}
