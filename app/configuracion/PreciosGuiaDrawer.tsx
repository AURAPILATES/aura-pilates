"use client";

import { useState } from "react";
import Drawer from "@/app/components/Drawer";

/** Botón de ayuda (?) + drawer que explica qué es la vista de Precios: de dónde salen los
 * precios y qué significa cada estado. Igual patrón que la guía de Clientes. */
export default function PreciosGuiaDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Cómo funciona esta vista"
        className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-navy/45 hover:text-navy hover:bg-navy/[0.05] transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>

      {open && (
        <Drawer
          title="Cómo funciona esta vista"
          subtitle="De dónde salen los precios y qué significa cada estado"
          maxWidth="max-w-[460px]"
          onClose={() => setOpen(false)}
        >
          <div className="px-6 py-5 space-y-6 text-[13px] text-navy/70 leading-relaxed">

            <div>
              <h3 className="text-[13px] font-bold text-navy mb-2">Para qué sirve</h3>
              <p>
                Cuando entra un cobro por Stripe, Stripe solo indica el <B>importe</B>, no qué
                producto se compró. La app lo deduce comparando ese importe con esta lista de precios.
                Es una vista de <B>solo lectura</B>: para cambiar un precio, hazlo en Momence.
              </p>
            </div>

            <div>
              <h3 className="text-[13px] font-bold text-navy mb-2">De dónde salen los precios</h3>
              <p>
                Se leen <B>en vivo</B> del catálogo de Momence (membresías y productos) por nombre
                exacto. Si un nombre no se encuentra ahí, se usa el <B>precio de respaldo</B> guardado
                en el código: una copia de seguridad para que la app siga funcionando aunque Momence
                no responda o un producto se haya renombrado.
              </p>
            </div>

            <div>
              <h3 className="text-[13px] font-bold text-navy mb-2">Qué significa cada estado</h3>
              <div className="space-y-2">
                <p>
                  <span className="inline-flex items-center bg-success/10 text-success rounded-full px-2 py-0.5 text-[11.5px] font-medium mr-1">En vivo desde Momence</span>
                  Usa el precio real de tu catálogo de Momence. Todo correcto.
                </p>
                <p>
                  <span className="inline-flex items-center bg-warning/10 text-warning rounded-full px-2 py-0.5 text-[11.5px] font-medium mr-1">Precio cambió</span>
                  El de Momence ya no coincide con el respaldo del código. No es un fallo: solo indica
                  que cambiaste el precio en Momence y el respaldo quedó desactualizado (la app usa el
                  de Momence igualmente).
                </p>
                <p>
                  <span className="inline-flex items-center bg-warning/10 text-warning rounded-full px-2 py-0.5 text-[11.5px] font-medium mr-1">Usando respaldo</span>
                  No se encontró ese producto en Momence por nombre, así que se está usando el precio
                  del código. Suele deberse a una diferencia en el nombre exacto.
                </p>
              </div>
            </div>

            <p className="text-[12px] text-navy/40 pt-1 border-t border-navy/[0.06]">
              Fuente: catálogo en vivo de Momence (membresías + productos) · respaldo en el código.
            </p>
          </div>
        </Drawer>
      )}
    </>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-navy">{children}</span>;
}
