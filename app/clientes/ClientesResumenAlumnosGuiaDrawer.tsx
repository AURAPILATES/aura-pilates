"use client";

import { useState } from "react";
import Link from "next/link";
import Drawer from "@/app/components/Drawer";

/** Botón "i" + drawer que explica de dónde sale Alumnos/Importe en Resumen alumnos - mismo
 * patrón que ClientesGuiaDrawer/PreciosGuiaDrawer. Solo texto, no lee datos. */
export default function ClientesResumenAlumnosGuiaDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="De dónde salen estos datos"
        className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-navy/45 hover:text-navy hover:bg-navy/[0.05] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="11" x2="12" y2="16" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {open && (
        <Drawer
          title="De dónde salen estos datos"
          subtitle="Cómo se calculan Alumnos e Importe en Resumen alumnos"
          maxWidth="max-w-[460px]"
          onClose={() => setOpen(false)}
        >
          <div className="px-6 py-5 space-y-6 text-[13px] text-navy/70 leading-relaxed">

            <Section title="Alumnos">
              <p>
                Para los 7 productos con cobro por <B>Stripe</B> (Bàsic, Plus, Pro, Pack 4/8 clases,
                Bono Benvinguda, Clase suelta): alumnos distintos que <B>pagaron</B> ese producto en el
                período - el mismo pago que cuenta en Importe, así que ambas filas describen el mismo
                hecho.
              </p>
              <p>
                Para <B>Urban</B>: Urban no genera un cobro individual por alumna, así que aquí el
                criterio es distinto - alumnas distintas que <B>asistieron</B> a clase en el período
                (check-ins reales de Momence, API v2).
              </p>
            </Section>

            <Section title="Importe">
              <p>
                Cobro real de Stripe para los 7 productos. <B>Otro</B> recoge pagos de Stripe que no
                casan con ningún precio conocido (p.ej. con cupón) - se mantiene aparte para que la
                fila Total cuadre con el ingreso real de Stripe del período.
              </p>
              <p>
                Para <B>Urban</B> el importe <B>no</B> es la transferencia real del banco - es una
                estimación en vivo: <B>clases asistidas × tarifa vigente</B> (hoy 11€/clase, editable en{" "}
                <Link href="/configuracion?tab=precios" className="text-primary hover:underline font-medium">
                  Configuración → Precios
                </Link>
                ). Urban paga a mes vencido, así que este importe no se concilia luego con el banco.
              </p>
            </Section>

            <Section title="Fila Total">
              <p>
                <B>Alumnos</B> no es la suma de las filas de abajo - es el nº de personas distintas
                (uniendo todos los productos), para no contar dos veces a quien compró más de un
                producto el mismo período. <B>Importe</B> sí es la suma de todas las filas, sin ese
                problema.
              </p>
            </Section>

            <Section title="Trimestre / Año">
              <p>
                Al agrupar por trimestre o año, el Importe suma los meses del período. Alumnos vuelve a
                unir las personas distintas de esos meses - no suma los recuentos mensuales, porque
                quien compra o asiste varios meses seguidos no debe contarse varias veces dentro del
                mismo período.
              </p>
            </Section>

            <p className="text-[12px] text-navy/40 pt-1 border-t border-navy/[0.06]">
              Fuentes: Stripe (pagos en tiempo real) · Momence API v2 (asistencia y check-ins de Urban) ·
              tarifa Urban en{" "}
              <Link href="/configuracion?tab=precios" className="text-primary hover:underline font-medium">
                Configuración → Precios
              </Link>
              .
            </p>
          </div>
        </Drawer>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[13px] font-bold text-navy mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-navy">{children}</span>;
}
